import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def _post(base, path, payload):
    req = urllib.request.Request(
        base + path, method="POST",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def test_single_process_end_to_end(tmp_path):
    port, ws_port = _free_port(), _free_port()
    # Hermetic HOME so a persisted ~/.pepper-studio/ai.json on the dev box can't
    # leak in and flip AI on (would route /chat to "ai" instead of "mock").
    home = str(tmp_path)
    env = dict(os.environ)
    env.update({
        "HOME": home,
        "USERPROFILE": home,  # Windows runner in the CI matrix
        "SIM_BRIDGE_PORT": str(port),
        "SIM_WS_PORT": str(ws_port),
        "SIM_OPEN_BROWSER": "0",
        "SIM_AI_BASE_URL": "",  # AI off → mock
        "SIM_PIPER_MODEL": "/nonexistent.onnx",  # piper off → exercise the core flow only
    })
    proc = subprocess.Popen(
        [sys.executable, "sim_bridge.py"],
        cwd=SIM_DIR, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        base = f"http://127.0.0.1:{port}"
        assert _wait_health(base), "bridge did not become healthy"

        with urllib.request.urlopen(base + "/", timeout=5) as r:
            assert r.status == 200
            assert 'id="root"' in r.read().decode()

        chat = _post(base, "/chat", {"text": "hello"})
        assert chat["success"] and chat["data"]["routed_to"] == "mock"

        speak = _post(base, "/speak", {"text": "hi"})
        assert speak["success"] is True
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
