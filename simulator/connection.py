"""SSH manager for the real Pepper bridge.

Connect / deploy / start / stop pepper/bridge.py on the robot over SSH —
key-based after a one-time password. Mirrors runner.py: owns the remote process
lifecycle with a ring-buffer log + status dict, callbacks, and atexit cleanup.
Studio-side only — NOT part of the robot HTTP contract.

SSH and the health HTTP call are dependency-injected (ssh_factory / http_get) so
the flow is unit-testable with fakes — no paramiko and no robot required.
"""
import json
import os
import shlex
import threading
import time
import urllib.request

try:
    import paramiko
    HAS_PARAMIKO = True
except ImportError:
    HAS_PARAMIKO = False

PEPPER_DIR = os.path.expanduser("~/.pepper-studio")
KEY_PATH = os.path.join(PEPPER_DIR, "id_pepper")
BRIDGE_SRC = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "pepper", "bridge.py")
LOG_MAX = 200

_lock = threading.Lock()
_state = {}
_client = None
_on_connected = None
_on_disconnected = None


def _reset_for_test():
    global _client
    with _lock:
        _state.clear()
        _state.update(state="disconnected", host="", user="",
                      bridge_url="", battery=None, error="", log=[])
    _client = None


_reset_for_test()


def set_callbacks(on_connected=None, on_disconnected=None):
    global _on_connected, _on_disconnected
    _on_connected, _on_disconnected = on_connected, on_disconnected


def _set(**kw):
    with _lock:
        _state.update(kw)


def _log(line):
    with _lock:
        _state["log"].append(line.rstrip("\n"))
        if len(_state["log"]) > LOG_MAX:
            del _state["log"][:-LOG_MAX]


def status():
    """Status dict for the UI. Log is joined to a string. Never holds a password."""
    with _lock:
        s = dict(_state)
        s["log"] = "\n".join(_state["log"])
        return s


def ensure_keypair():
    """Generate an RSA keypair in ~/.pepper-studio once (private 0600). Returns
    the public-key line. Requires paramiko (only used on the real connect path)."""
    if not os.path.isdir(PEPPER_DIR):
        os.makedirs(PEPPER_DIR, 0o700)
    pub_path = KEY_PATH + ".pub"
    if not os.path.exists(KEY_PATH):
        key = paramiko.RSAKey.generate(2048)
        key.write_private_key_file(KEY_PATH)
        os.chmod(KEY_PATH, 0o600)
        with open(pub_path, "w") as f:
            f.write("ssh-rsa %s pepper-studio\n" % key.get_base64())
    with open(pub_path) as f:
        return f.read().strip()


def _default_http_get(url, timeout=5):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _default_ssh_factory():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    return c


def _load_pkey():
    if HAS_PARAMIKO and os.path.exists(KEY_PATH):
        return paramiko.RSAKey.from_private_key_file(KEY_PATH)
    return "PEPPER_STUDIO_KEY"  # sentinel; tests inject a fake ssh that ignores it


def _install_pubkey(ssh, pub_line):
    """Append our pubkey to the robot's ~/.ssh/authorized_keys, idempotently."""
    sftp = ssh.open_sftp()
    try:
        try:
            sftp.mkdir(".ssh", 0o700)
        except Exception:
            pass
        existing = ""
        try:
            with sftp.open(".ssh/authorized_keys", "r") as f:
                data = f.read()
            existing = data.decode("utf-8", "replace") if isinstance(data, bytes) else data
        except Exception:
            existing = ""
        if pub_line not in existing:
            with sftp.open(".ssh/authorized_keys", "a") as f:
                f.write(pub_line + "\n")
        try:
            sftp.chmod(".ssh/authorized_keys", 0o600)
        except Exception:
            pass
    finally:
        sftp.close()


def _pump(stdout):
    try:
        for line in stdout:
            if isinstance(line, bytes):  # paramiko ChannelFile yields bytes on py3
                line = line.decode("utf-8", "replace")
            _log(line)
    except Exception:
        pass


def _do_connect(host, user, password, ssh_port, naoqi_port, bridge_port,
                ssh_factory, http_get, connect_timeout=30.0, poll_interval=1.0):
    """The connect flow, run synchronously. Tests call this directly."""
    global _client
    _set(state="connecting", host=host, user=user, error="", log=[],
         bridge_url="", battery=None)
    try:
        pub_line = ensure_keypair()
        ssh = ssh_factory()

        # 1) key auth first; fall back to password + install the key
        try:
            ssh.connect(hostname=host, port=ssh_port, username=user,
                        pkey=_load_pkey(), timeout=10)
        except Exception:
            if not password:
                _set(state="error",
                     error="Key auth not set up. Enter the password once to install the key.")
                return
            ssh.connect(hostname=host, port=ssh_port, username=user,
                        password=password, timeout=10)
            _log("[init] installing SSH key for passwordless access")
            _install_pubkey(ssh, pub_line)

        # 2) deploy the current bridge.py
        _log("[init] deploying bridge.py")
        sftp = ssh.open_sftp()
        sftp.put(BRIDGE_SRC, "bridge.py")
        sftp.close()

        # 3) free the port, start the bridge, stream its stdout
        ssh.exec_command("fuser -k %d/tcp" % bridge_port)
        time.sleep(0.5)
        cmd = "python bridge.py --ip 127.0.0.1 --port %d --bridge-port %d" % (
            naoqi_port, bridge_port)
        # Run via a login+interactive shell so the robot's NAOqi environment
        # (the PYTHONPATH set in /etc/profile or ~/.bashrc) is loaded — a bare
        # exec_command uses a non-login non-interactive shell that can't import
        # naoqi. get_pty so -i behaves and the process is HUP'd if the channel drops.
        wrapped = "bash -ilc %s" % shlex.quote(cmd)
        _log("[init] starting: %s" % cmd)
        _stdin, stdout, _stderr = ssh.exec_command(wrapped, get_pty=True)
        _client = ssh
        threading.Thread(target=_pump, args=(stdout,), daemon=True).start()

        # 4) poll /health until ok or timeout
        url = "http://%s:%d/health" % (host, bridge_port)
        deadline = time.time() + connect_timeout
        while True:
            try:
                r = http_get(url, timeout=5)
                if r.get("success"):
                    _set(state="connected",
                         bridge_url="http://%s:%d" % (host, bridge_port),
                         battery=(r.get("data") or {}).get("battery"))
                    if _on_connected:
                        _on_connected(host, bridge_port)
                    return
            except Exception:
                pass
            if time.time() >= deadline:
                break
            time.sleep(poll_interval)
        _set(state="error", error="Bridge started but /health never responded")
    except Exception as e:
        _set(state="error", error="%s: %s" % (type(e).__name__, e))


def connect(host, user, password=None, ssh_port=22, naoqi_port=9559,
            bridge_port=5001, ssh_factory=None, http_get=None):
    """Start the connect flow on a worker thread (returns immediately)."""
    if ssh_factory is None and not HAS_PARAMIKO:
        _set(state="error", host=host, user=user,
             error="paramiko not installed on the Studio host — run: pip install paramiko")
        return
    ssh_factory = ssh_factory or _default_ssh_factory
    http_get = http_get or _default_http_get
    threading.Thread(
        target=_do_connect,
        args=(host, user, password, ssh_port, naoqi_port, bridge_port,
              ssh_factory, http_get),
        daemon=True).start()


def disconnect():
    """Kill the remote bridge and close SSH. The app owns the lifecycle, so this
    (and atexit) guarantee no orphan bridge is left running on the robot."""
    global _client
    ssh = _client
    if ssh is not None:
        try:
            ssh.exec_command("fuser -k 5001/tcp")
        except Exception:
            pass
        try:
            ssh.close()
        except Exception:
            pass
    _client = None
    _set(state="disconnected", bridge_url="", battery=None)
    if _on_disconnected:
        _on_disconnected()
