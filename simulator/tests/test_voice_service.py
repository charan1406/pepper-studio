"""Tests for voice_service — the in-app push-to-talk turn driver.

voice_loop.one_turn is monkeypatched (its own pipeline is tested elsewhere); we
assert the service builds the UI transcript, surfaces 'heard nothing', and
guards against concurrent turns.
"""
import os
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

import voice_service  # noqa: E402


def setup_function():
    voice_service._reset_for_test()


class FakeBrain:
    enabled = True


def _factory(_url):
    return object()  # one_turn is monkeypatched, so the client is unused


def test_initial_status_idle():
    s = voice_service.status()
    assert s["state"] == "idle"
    assert s["transcript"] == []


def test_turn_builds_transcript(monkeypatch):
    monkeypatch.setattr(voice_service.voice_loop, "one_turn",
                        lambda *a, **k: {"heard": "hello", "lang": "en",
                                         "reply": "Hi there!", "kind": "chat"})
    voice_service._do_turn(FakeBrain(), "http://x:5001", 5, "small", _factory)
    s = voice_service.status()
    assert s["state"] == "idle"
    assert s["transcript"] == [
        {"role": "user", "text": "hello", "kind": "en"},
        {"role": "pepper", "text": "Hi there!", "kind": "chat"},
    ]
    assert s["error"] == ""


def test_searxng_url_passed_through_to_one_turn(monkeypatch):
    seen = {}
    monkeypatch.setattr(voice_service.voice_loop, "one_turn",
                        lambda *a, **k: seen.update(k) or
                        {"heard": "h", "lang": "en", "reply": "r", "kind": "chat"})
    voice_service._do_turn(FakeBrain(), "http://x:5001", 5, "small", _factory,
                           "http://searx.local")
    assert seen["searxng_url"] == "http://searx.local"


def test_turn_nothing_heard_sets_error(monkeypatch):
    monkeypatch.setattr(voice_service.voice_loop, "one_turn", lambda *a, **k: None)
    voice_service._do_turn(FakeBrain(), "http://x:5001", 5, "small", _factory)
    s = voice_service.status()
    assert s["state"] == "idle"
    assert s["transcript"] == []
    assert "heard nothing" in s["error"]


def test_turn_exception_is_caught(monkeypatch):
    def _boom(*a, **k):
        raise RuntimeError("bridge down")
    monkeypatch.setattr(voice_service.voice_loop, "one_turn", _boom)
    voice_service._do_turn(FakeBrain(), "http://x:5001", 5, "small", _factory)
    s = voice_service.status()
    assert s["state"] == "idle"
    assert "bridge down" in s["error"]


def test_talk_is_noop_while_busy(monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(voice_service.voice_loop, "one_turn",
                        lambda *a, **k: called.__setitem__("n", called["n"] + 1) or
                        {"heard": "x", "lang": "en", "reply": "y", "kind": "chat"})
    voice_service._state["state"] = "busy"  # simulate an in-flight turn
    r = voice_service.talk(FakeBrain(), "http://x:5001", client_factory=_factory)
    assert r["state"] == "busy"
    assert called["n"] == 0  # no new turn started


def test_clear_resets():
    voice_service._append("user", "hi")
    voice_service.clear()
    assert voice_service.status()["transcript"] == []


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


def test_voice_status_endpoint_idle(bridge):
    r = _get(bridge, "/voice/status")
    assert r["success"] and r["data"]["state"] == "idle"


def test_voice_talk_requires_bridge_url(bridge):
    r = _post(bridge, "/voice/talk", {})
    assert r["success"] is False and "bridge_url" in r["error"]
