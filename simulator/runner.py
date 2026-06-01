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
