"""Local llama-server sidecar manager. Stdlib only.

Spawns a user-provided llama-server on a chosen GGUF, monitors it (stdout ring
log + /health poll), exposes start/stop/status. One sidecar at a time. The
bridge registers on_ready/on_exit callbacks to point the AI dial at the sidecar
while it is ready. No auto-download/compile — bring your own binary.
"""
import json
import os
import shlex
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from collections import deque

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".pepper-studio")
CONFIG_PATH = os.path.join(CONFIG_DIR, "runner.json")

DEFAULTS = {"models_dir": "", "binary": "", "gguf": "", "flags": {}}
_KEYS = ("models_dir", "binary", "gguf", "flags")

HEALTH_TIMEOUT = 180  # seconds to reach ready (model load can be slow)

_lock = threading.Lock()
_state = {
    "state": "stopped",   # stopped | starting | ready | error
    "proc": None,
    "port": None,
    "base_url": "",
    "gguf": None,
    "error": None,
    "log": deque(maxlen=200),
}
_on_ready = None
_on_exit = None


def set_callbacks(on_ready=None, on_exit=None):
    global _on_ready, _on_exit
    _on_ready, _on_exit = on_ready, on_exit


def load():
    cfg = dict(DEFAULTS)
    if os.path.isfile(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as f:
                data = json.load(f)
            cfg.update({k: data[k] for k in _KEYS if k in data})
        except (ValueError, OSError):
            pass
    return cfg


def save(cfg):
    try:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        out = {k: cfg.get(k, DEFAULTS[k]) for k in _KEYS}
        tmp = CONFIG_PATH + ".tmp"
        with open(tmp, "w") as f:
            json.dump(out, f, indent=2)
        os.chmod(tmp, 0o600)
        os.replace(tmp, CONFIG_PATH)
        return True
    except OSError:
        return False


def list_models(models_dir):
    d = os.path.expanduser(models_dir or "")
    if not d or not os.path.isdir(d):
        return []
    return sorted(f for f in os.listdir(d) if f.endswith(".gguf"))


def resolve_binary(configured=None):
    if configured:
        p = os.path.expanduser(configured)
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
        return None  # explicit path given but invalid — don't silently fall back
    return shutil.which("llama-server")


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def build_argv(binary, gguf, port, flags):
    argv = [binary, "--model", gguf, "--host", "127.0.0.1", "--port", str(port)]
    if flags.get("ngl") not in (None, ""):
        argv += ["-ngl", str(int(flags["ngl"]))]
    if flags.get("ctx") not in (None, ""):
        argv += ["-c", str(int(flags["ctx"]))]
    if flags.get("cache_type"):
        argv += ["--cache-type-k", str(flags["cache_type"]), "--cache-type-v", str(flags["cache_type"])]
    if flags.get("flash_attn"):
        argv += ["-fa"]
    if flags.get("mmproj"):
        argv += ["--mmproj", os.path.expanduser(str(flags["mmproj"]))]
    if flags.get("extra_args"):
        argv += shlex.split(flags["extra_args"])
    return argv


def status():
    with _lock:
        proc = _state["proc"]
        return {
            "state": _state["state"],
            "port": _state["port"],
            "base_url": _state["base_url"],
            "gguf": _state["gguf"],
            "pid": proc.pid if proc else None,
            "error": _state["error"],
            "log": list(_state["log"]),
        }


def active():
    """Return (base_url, model) when ready, else ('', '')."""
    with _lock:
        if _state["state"] == "ready":
            return _state["base_url"], (_state["gguf"] or "local")
        return "", ""


def _set_error(msg):
    with _lock:
        _state.update(state="error", error=msg, base_url="")
    return status()


def stop():
    with _lock:
        proc = _state["proc"]
        _state.update(state="stopped", proc=None, port=None, base_url="", error=None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    if proc and _on_exit:  # only fire when we actually stopped a live sidecar
        _on_exit()
    return status()


def start(gguf_path, flags, binary=None):
    bin_path = resolve_binary(binary)
    if not bin_path:
        return _set_error("llama-server not found (set the binary path or install it — see LLAMA_SETUP.md)")
    gguf = os.path.expanduser(gguf_path or "")
    if not gguf or not gguf.endswith(".gguf") or not os.path.isfile(gguf):
        return _set_error(f"GGUF not found: {gguf_path}")
    try:
        shlex.split(flags.get("extra_args") or "")
    except ValueError as e:
        return _set_error(f"bad extra args: {e}")
    if _state["proc"]:
        stop()
    port = _free_port()
    argv = build_argv(bin_path, gguf, port, flags)
    try:
        proc = subprocess.Popen(
            argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
    except OSError as e:
        return _set_error(f"failed to launch: {e}")
    model_name = os.path.basename(gguf)
    with _lock:
        _state.update(state="starting", proc=proc, port=port, base_url="", gguf=model_name, error=None)
        _state["log"].clear()
    threading.Thread(target=_read_log, args=(proc,), daemon=True).start()
    threading.Thread(target=_poll_health, args=(proc, port, model_name), daemon=True).start()
    return status()


def _read_log(proc):
    for line in proc.stdout:
        with _lock:
            _state["log"].append(line.rstrip("\n"))
    code = proc.wait()
    fire = False
    with _lock:
        if _state["proc"] is proc and _state["state"] in ("starting", "ready"):
            if code == 0:
                _state.update(state="stopped", base_url="", proc=None)
            else:
                _state.update(state="error", base_url="", error=f"llama-server exited (code {code})", proc=None)
            fire = True
    # Only fire if THIS proc's exit transitioned state; stop() fires on_exit itself.
    if fire and _on_exit:
        _on_exit()


def _poll_health(proc, port, model_name):
    url = f"http://127.0.0.1:{port}/health"
    deadline = time.time() + HEALTH_TIMEOUT
    while time.time() < deadline:
        if proc.poll() is not None:
            return  # exited before ready; _read_log sets state
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    base = f"http://127.0.0.1:{port}/v1"
                    fire = False
                    with _lock:
                        if _state["proc"] is proc:
                            _state.update(state="ready", base_url=base, error=None)
                            fire = True
                    # Don't fire on_ready for a stale proc (superseded by a newer start).
                    if fire and _on_ready:
                        _on_ready(base, model_name)
                    return
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
        time.sleep(0.5)
    # Timeout: leave proc set (it may still be alive) so stop() can reap it; do NOT
    # clear proc or fire on_exit here — the brain never switched to a ready sidecar.
    with _lock:
        if _state["proc"] is proc and _state["state"] != "ready":
            _state.update(state="error", error="timed out waiting for llama-server /health")
