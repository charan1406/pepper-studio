import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request

# conftest lives in the same directory; make it importable regardless of pytest's
# sys.path manipulation (needed because tests/ has __init__.py, making it a package).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from conftest import bridge_proc  # noqa: F401

FAKE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fake_llama_server.py")


def _post(base, path, payload):
    req = urllib.request.Request(
        base + path, method="POST", data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def _get(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as r:
        return json.loads(r.read())


def _tmp_gguf(dir_):
    path = os.path.join(dir_, "model.gguf")
    with open(path, "w") as f:
        f.write("x")
    return path


def _wait_runner(base, target, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _get(base, "/ai/runner/status")["data"]["state"] == target:
            return True
        time.sleep(0.2)
    return False


def _pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def test_runner_models_lists_gguf(ai_bridge):
    d = tempfile.mkdtemp()
    open(os.path.join(d, "x.gguf"), "w").close()
    r = _get(ai_bridge.base, f"/ai/runner/models?dir={d}")
    assert r["success"] and "x.gguf" in r["data"]["models"]


def test_runner_start_reaches_ready_and_points_dial(ai_bridge):
    d = tempfile.mkdtemp()
    gguf = _tmp_gguf(d)
    r = _post(ai_bridge.base, "/ai/runner/start", {"gguf": gguf, "binary": FAKE})
    assert r["success"]
    assert _wait_runner(ai_bridge.base, "ready"), _get(ai_bridge.base, "/ai/runner/status")
    st = _get(ai_bridge.base, "/ai/runner/status")["data"]
    assert st["base_url"].endswith("/v1")
    assert _get(ai_bridge.base, "/ai/config")["data"]["enabled"] is True
    _post(ai_bridge.base, "/ai/runner/stop", {})


def test_bridge_exit_kills_sidecar():
    d = tempfile.mkdtemp()
    gguf = _tmp_gguf(d)
    with bridge_proc() as b:
        _post(b.base, "/ai/runner/start", {"gguf": gguf, "binary": FAKE})
        assert _wait_runner(b.base, "ready")
        pid = _get(b.base, "/ai/runner/status")["data"]["pid"]
        assert pid and _pid_alive(pid)
    deadline = time.time() + 5
    while time.time() < deadline and _pid_alive(pid):
        time.sleep(0.1)
    assert not _pid_alive(pid), "sidecar orphaned after bridge exit"
