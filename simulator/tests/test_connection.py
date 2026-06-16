"""Tests for connection.py — SSH/bridge lifecycle.

SSH and the health HTTP call are injected as fakes, so these run with no
paramiko and no robot. We drive the synchronous core _do_connect() directly and
assert the flow: key auth first, password->key-install fallback, bridge.py
deployed + started, health -> connected, disconnect kills the remote bridge.
"""
import io
import os
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

import connection  # noqa: E402


def setup_function():
    connection._reset_for_test()
    connection.set_callbacks()  # clear


# ── fakes ──────────────────────────────────────────────────────────

class FakeSFTP:
    def __init__(self, store, has_authkeys=False):
        self.store = store
        self.has_authkeys = has_authkeys

    def mkdir(self, p, mode=0o700):
        self.store.setdefault("mkdir", []).append(p)

    def open(self, path, mode="r"):
        if "r" in mode and "authorized_keys" in path and not self.has_authkeys:
            raise IOError("no such file")
        buf = io.StringIO()
        self.store.setdefault("writes", []).append(path)
        return buf

    def put(self, local, remote):
        self.store["put"] = (local, remote)

    def chmod(self, p, m):
        pass

    def close(self):
        pass


class FakeSSH:
    def __init__(self, fail_key=False, store=None):
        self.fail_key = fail_key
        self.store = store if store is not None else {}
        self.connected_with = None
        self.commands = []
        self.closed = False

    def connect(self, hostname, port=22, username=None, pkey=None,
                password=None, timeout=10):
        if pkey is not None and self.fail_key:
            raise Exception("key auth refused")
        self.connected_with = "key" if pkey is not None else "password"

    def open_sftp(self):
        return FakeSFTP(self.store)

    def exec_command(self, cmd):
        self.commands.append(cmd)
        stdout = io.StringIO("[INIT] ok\n[BRIDGE] Listening on port 5001\n"
                             if "bridge.py" in cmd else "")
        return io.StringIO(), stdout, io.StringIO()

    def close(self):
        self.closed = True


def _ok_health(url, timeout=5):
    return {"success": True, "data": {"battery": 88}}


def _no_keypair(monkeypatch):
    monkeypatch.setattr(connection, "ensure_keypair",
                        lambda: "ssh-rsa AAA pepper-studio")
    monkeypatch.setattr(connection, "_load_pkey", lambda: "KEY")


# ── status / log ───────────────────────────────────────────────────

def test_initial_status_disconnected():
    s = connection.status()
    assert s["state"] == "disconnected"
    assert s["bridge_url"] == ""
    assert s["log"] == ""


def test_log_ring_caps():
    for i in range(connection.LOG_MAX + 50):
        connection._log("line %d" % i)
    assert connection.status()["log"].count("\n") == connection.LOG_MAX - 1


# ── connect flow ───────────────────────────────────────────────────

def test_connect_key_first_then_connected(monkeypatch):
    _no_keypair(monkeypatch)
    store = {}
    ssh = FakeSSH(fail_key=False, store=store)
    connection._do_connect("1.2.3.4", "nao", None, 22, 9559, 5001,
                           lambda: ssh, _ok_health)
    s = connection.status()
    assert s["state"] == "connected"
    assert s["bridge_url"] == "http://1.2.3.4:5001"
    assert s["battery"] == 88
    assert ssh.connected_with == "key"
    assert store["put"][1] == "bridge.py"               # deployed
    assert any("bridge.py" in c for c in ssh.commands)  # started
    assert any("fuser -k" in c for c in ssh.commands)   # freed the port


def test_connect_password_installs_key(monkeypatch):
    _no_keypair(monkeypatch)
    store = {}
    ssh = FakeSSH(fail_key=True, store=store)  # key auth fails -> password path
    connection._do_connect("1.2.3.4", "nao", "nao", 22, 9559, 5001,
                           lambda: ssh, _ok_health)
    assert connection.status()["state"] == "connected"
    assert ssh.connected_with == "password"
    # pubkey install wrote to authorized_keys
    assert any("authorized_keys" in w for w in store.get("writes", []))


def test_connect_key_fails_no_password_errors(monkeypatch):
    _no_keypair(monkeypatch)
    ssh = FakeSSH(fail_key=True)
    connection._do_connect("1.2.3.4", "nao", None, 22, 9559, 5001,
                           lambda: ssh, _ok_health)
    s = connection.status()
    assert s["state"] == "error"
    assert "password" in s["error"].lower()


def test_connect_health_timeout_errors(monkeypatch):
    _no_keypair(monkeypatch)
    ssh = FakeSSH(fail_key=False)

    def _down(url, timeout=5):
        raise IOError("connection refused")

    connection._do_connect("1.2.3.4", "nao", None, 22, 9559, 5001,
                           lambda: ssh, _down,
                           connect_timeout=0.05, poll_interval=0.01)
    s = connection.status()
    assert s["state"] == "error"
    assert "health" in s["error"].lower()


def test_connect_fires_on_connected_callback(monkeypatch):
    _no_keypair(monkeypatch)
    seen = {}
    connection.set_callbacks(on_connected=lambda h, p: seen.update(host=h, port=p))
    ssh = FakeSSH(fail_key=False)
    connection._do_connect("9.9.9.9", "nao", None, 22, 9559, 5001,
                           lambda: ssh, _ok_health)
    assert seen == {"host": "9.9.9.9", "port": 5001}


# ── disconnect ─────────────────────────────────────────────────────

def test_connect_without_paramiko_gives_clear_error(monkeypatch):
    monkeypatch.setattr(connection, "HAS_PARAMIKO", False)
    connection.connect("1.2.3.4", "nao")  # no ssh_factory -> would use real paramiko
    s = connection.status()
    assert s["state"] == "error"
    assert "paramiko" in s["error"].lower()


def test_disconnect_kills_and_closes():
    ssh = FakeSSH()
    connection._client = ssh
    connection._set(state="connected", bridge_url="http://1.2.3.4:5001")
    connection.disconnect()
    s = connection.status()
    assert s["state"] == "disconnected"
    assert s["bridge_url"] == ""
    assert ssh.closed
    assert any("fuser -k" in c for c in ssh.commands)


# ── endpoints (against a live bridge subprocess) ───────────────────

import json as _json  # noqa: E402
import urllib.request  # noqa: E402


def _get(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as r:
        return _json.loads(r.read())


def _post(base, path, payload):
    req = urllib.request.Request(
        base + path, method="POST", data=_json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return _json.loads(r.read())


def test_robot_status_endpoint_disconnected(bridge):
    r = _get(bridge, "/robot/status")
    assert r["success"] and r["data"]["state"] == "disconnected"


def test_robot_connect_requires_host(bridge):
    r = _post(bridge, "/robot/connect", {})
    assert r["success"] is False and "host" in r["error"]


def test_robot_connect_never_echoes_password(bridge):
    r = _post(bridge, "/robot/connect",
              {"host": "203.0.113.5", "user": "nao", "password": "supersecret"})
    assert r["success"] is True
    assert "supersecret" not in _json.dumps(r)
    assert "supersecret" not in _json.dumps(_get(bridge, "/robot/status"))
    _post(bridge, "/robot/disconnect", {})
