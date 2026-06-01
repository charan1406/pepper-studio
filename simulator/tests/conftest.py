import contextlib
import os
import shutil
import site
import socket
import subprocess
import sys
import tempfile
import time
import types
import urllib.error
import urllib.request

import pytest

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Preserve the real user base so packages installed with --user are still found
# when bridge subprocesses run with an overridden HOME (isolated test directory).
_REAL_PYTHONUSERBASE = site.getuserbase()


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _wait_health(base, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(base + "/health", timeout=2) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.3)
    return False


def _wait_ws(port, timeout=10):
    """Poll until the WebSocket port accepts a TCP connection."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=1)
            s.close()
            return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.2)
    return False


@contextlib.contextmanager
def bridge_proc(home=None, env_extra=None):
    """Launch a standalone bridge with an isolated HOME; yield base/ws_port/home."""
    own_home = home is None
    home = home or tempfile.mkdtemp(prefix="pepper-home-")
    port, ws_port = _free_port(), _free_port()
    env = dict(os.environ)
    env.update({
        "SIM_BRIDGE_PORT": str(port),
        "SIM_WS_PORT": str(ws_port),
        "SIM_OPEN_BROWSER": "0",
        "SIM_AI_BASE_URL": "",
        "HOME": home,
        # Keep --user packages (websockets etc.) accessible when HOME is overridden.
        "PYTHONUSERBASE": _REAL_PYTHONUSERBASE,
    })
    if env_extra:
        env.update(env_extra)
    proc = subprocess.Popen(
        [sys.executable, "sim_bridge.py"],
        cwd=SIM_DIR, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        assert _wait_health(base), "bridge did not become healthy"
        _wait_ws(ws_port)  # best-effort; WS thread starts after HTTP
        yield types.SimpleNamespace(base=base, ws_port=ws_port, home=home)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if own_home:
            shutil.rmtree(home, ignore_errors=True)


@pytest.fixture
def bridge():
    """Yield just the base URL (back-compat with test_control.py)."""
    with bridge_proc() as b:
        yield b.base


@pytest.fixture
def ai_bridge():
    """Yield base/ws_port/home for AI-config tests."""
    with bridge_proc() as b:
        yield b
