import json
import urllib.request

# Fields the frontend store (updateFromWS) reads off the state payload.
EXPECTED_KEYS = {
    "position", "is_moving", "joints", "posture", "battery", "eye_color",
    "is_speaking", "current_speech", "speech_language", "tablet",
    "autonomous_life", "face_tracking", "current_animation",
    "is_exploring", "has_map", "nav_target", "room_objects", "api_log", "uptime",
}


def _get(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as r:
        return r.status, json.loads(r.read())


def test_state_returns_success_envelope(bridge):
    status, resp = _get(bridge, "/state")
    assert status == 200
    assert resp.get("success") is True
    assert isinstance(resp.get("data"), dict)


def test_state_data_covers_store_contract(bridge):
    _, resp = _get(bridge, "/state")
    data = resp["data"]
    missing = EXPECTED_KEYS - set(data.keys())
    assert not missing, f"/state missing store fields: {sorted(missing)}"
    assert isinstance(data["joints"], dict) and data["joints"], "joints must be a non-empty dict"
    assert set(data["position"]) >= {"x", "y", "theta"}
