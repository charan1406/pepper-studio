import json
import os
import time
import urllib.request

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def test_control_endpoints_all_succeed(bridge):
    # Every control action the manual panel issues.
    assert _post(bridge, "/move/velocity", {"x": 0.5, "y": 0, "theta": -0.3})["success"]
    assert _post(bridge, "/move/stop", {})["success"]

    r = _post(bridge, "/posture/set", {"posture": "Stand", "speed": 0.5})
    assert r["success"] and r["data"]["posture"] == "Stand"

    assert _post(bridge, "/speak", {"text": "hello", "language": "en"})["success"]
    assert _post(bridge, "/speak/stop", {})["success"]

    r = _post(bridge, "/leds/eyes", {"r": 0, "g": 255, "b": 0})
    assert r["success"] and r["data"]["r"] == 0

    anims = _get(bridge, "/animation/list")
    assert anims["success"] and len(anims["data"]["animations"]) > 0
    first = anims["data"]["animations"][0]
    assert _post(bridge, "/animation/run", {"name": first})["success"]

    assert _post(bridge, "/head/set", {"yaw": 0.1, "pitch": -0.2, "speed": 0.2})["success"]
    assert _post(bridge, "/navigate/goto", {"x": 1.0, "y": 1.0, "theta": 0})["success"]


def test_control_endpoints_drive_state(bridge):
    """Contract test asserts success; this asserts the state actually moved."""
    # Posture is set immediately.
    _post(bridge, "/posture/set", {"posture": "Sit", "speed": 0.8})
    assert _get(bridge, "/posture/current")["data"]["posture"] == "Sit"

    # Head joints interpolate toward the target; sample until they converge.
    _post(bridge, "/head/set", {"yaw": 0.5, "pitch": 0.3, "speed": 0.8})
    deadline = time.time() + 3
    yaw = pitch = 999.0
    while time.time() < deadline:
        yaw, pitch = _get(bridge, "/joints/angles?names=Head")["data"]["angles"]
        if abs(yaw - 0.5) < 0.05 and abs(pitch - 0.3) < 0.05:
            break
        time.sleep(0.1)
    assert abs(yaw - 0.5) < 0.05 and abs(pitch - 0.3) < 0.05, f"head did not reach target: {yaw}, {pitch}"

    # Out-of-limit angles are clamped to NAOqi joint limits, never exceeded.
    _post(bridge, "/head/set", {"yaw": 99, "pitch": -99, "speed": 1.0})
    time.sleep(1.0)
    yaw, pitch = _get(bridge, "/joints/angles?names=Head")["data"]["angles"]
    assert yaw <= 2.0857 and pitch >= -0.7068, f"joint limits exceeded: {yaw}, {pitch}"

    # Velocity command moves the robot; stop halts it.
    x0 = _get(bridge, "/navigate/position")["data"]["x"]
    _post(bridge, "/move/velocity", {"x": 0.6, "y": 0, "theta": 0})
    time.sleep(0.8)
    x1 = _get(bridge, "/navigate/position")["data"]["x"]
    assert x1 > x0, f"robot did not move: {x0} -> {x1}"

    # Bad posture is rejected without corrupting state.
    assert _post(bridge, "/posture/set", {"posture": "Banana"})["success"] is False
    assert _get(bridge, "/posture/current")["data"]["posture"] == "Sit"


def test_speak_holds_is_speaking(bridge):
    """Regression: /speak must report is_speaking past ~100ms even without piper TTS.

    The bug: speak_local always set _tts_process to a shell pipeline that exits
    instantly when piper is absent, so finish() waited on it and is_speaking
    collapsed to ~0ms instead of using the word-count time estimate.
    """
    assert _post(bridge, "/speak", {"text": "hello from the verification suite"})["success"]
    time.sleep(0.3)
    assert _get(bridge, "/speak/status")["data"]["is_speaking"], \
        "is_speaking collapsed within 0.3s — /speak duration regressed"
