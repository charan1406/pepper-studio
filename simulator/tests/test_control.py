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


def _get(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as r:
        return json.loads(r.read())


def test_control_endpoints_all_succeed():
    port, ws_port = _free_port(), _free_port()
    env = dict(os.environ)
    env.update({
        "SIM_BRIDGE_PORT": str(port),
        "SIM_WS_PORT": str(ws_port),
        "SIM_OPEN_BROWSER": "0",
        "SIM_AI_BASE_URL": "",
    })
    proc = subprocess.Popen(
        [sys.executable, "sim_bridge.py"],
        cwd=SIM_DIR, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        base = f"http://127.0.0.1:{port}"
        assert _wait_health(base), "bridge did not become healthy"

        # Every control action the manual panel issues.
        assert _post(base, "/move/velocity", {"x": 0.5, "y": 0, "theta": -0.3})["success"]
        assert _post(base, "/move/stop", {})["success"]

        r = _post(base, "/posture/set", {"posture": "Stand", "speed": 0.5})
        assert r["success"] and r["data"]["posture"] == "Stand"

        assert _post(base, "/speak", {"text": "hello", "language": "en"})["success"]
        assert _post(base, "/speak/stop", {})["success"]

        r = _post(base, "/leds/eyes", {"r": 0, "g": 255, "b": 0})
        assert r["success"] and r["data"]["r"] == 0

        anims = _get(base, "/animation/list")
        assert anims["success"] and len(anims["data"]["animations"]) > 0
        first = anims["data"]["animations"][0]
        assert _post(base, "/animation/run", {"name": first})["success"]

        assert _post(base, "/head/set", {"yaw": 0.1, "pitch": -0.2, "speed": 0.2})["success"]
        assert _post(base, "/navigate/goto", {"x": 1.0, "y": 1.0, "theta": 0})["success"]
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
