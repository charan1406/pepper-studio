import json
import os
import stat
import sys
import urllib.error
import urllib.request

from websockets.sync.client import connect

# conftest lives in the same directory; make it importable regardless of pytest's
# sys.path manipulation (needed because tests/ has __init__.py, making it a package).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from conftest import bridge_proc  # noqa: F401  (also pulls shared fixtures)


def _post(base, path, payload):
    req = urllib.request.Request(
        base + path, method="POST",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def _get(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as r:
        return json.loads(r.read())


def _ws_frame(ws_port, timeout=5.0):
    """Connect and return the first state frame, waiting up to `timeout`s.

    Returns None only if no frame arrives — callers must assert it is not None,
    otherwise the leak check below would be vacuous (json.dumps(None) == "null").
    """
    with connect(f"ws://127.0.0.1:{ws_port}", open_timeout=timeout) as ws:
        try:
            return json.loads(ws.recv(timeout=timeout))
        except TimeoutError:
            return None


def test_get_default_has_no_key(ai_bridge):
    r = _get(ai_bridge.base, "/ai/config")
    assert r["success"]
    assert "api_key" not in r["data"]
    assert r["data"]["enabled"] is False
    assert r["data"]["key_set"] is False


def test_post_sets_and_persists_without_leaking_key(ai_bridge):
    st, r = _post(ai_bridge.base, "/ai/config",
                  {"base_url": "http://localhost:9/v1", "model": "m", "api_key": "SECRET_TOKEN"})
    assert st == 200 and r["success"]
    assert r["data"]["enabled"] is True
    assert r["data"]["key_set"] is True
    assert "api_key" not in r["data"]

    path = os.path.join(ai_bridge.home, ".pepper-studio", "ai.json")
    assert os.path.isfile(path)
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600

    got = _get(ai_bridge.base, "/ai/config")
    assert "SECRET_TOKEN" not in json.dumps(got)

    frame = _ws_frame(ai_bridge.ws_port)
    assert frame is not None, "no WS frame received — leak check would be vacuous"
    blob = json.dumps(frame)
    assert "SECRET_TOKEN" not in blob, "api_key leaked into the WS broadcast"
    # The POST /ai/config body IS in the broadcast api_log — redacted to ***.
    # Its presence proves the secret's absence is due to redaction, not an empty frame.
    assert "***" in blob, "expected the redacted /ai/config call in the broadcast api_log"


def test_partial_update_preserves_key(ai_bridge):
    _post(ai_bridge.base, "/ai/config", {"base_url": "http://x/v1", "api_key": "K"})
    _post(ai_bridge.base, "/ai/config", {"model": "other"})
    r = _get(ai_bridge.base, "/ai/config")
    assert r["data"]["key_set"] is True
    assert r["data"]["model"] == "other"


def test_empty_string_clears_key(ai_bridge):
    _post(ai_bridge.base, "/ai/config", {"base_url": "http://x/v1", "api_key": "K"})
    _post(ai_bridge.base, "/ai/config", {"api_key": ""})
    r = _get(ai_bridge.base, "/ai/config")
    assert r["data"]["key_set"] is False


def test_ai_test_unreachable_returns_error(ai_bridge):
    st, r = _post(ai_bridge.base, "/ai/test", {"base_url": "http://127.0.0.1:1/v1", "model": "m"})
    assert st == 200
    assert r["success"] is False
    assert r["error"]


def test_env_seeds_first_run():
    with bridge_proc(env_extra={"SIM_AI_BASE_URL": "http://seed/v1", "SIM_AI_API_KEY": "envkey"}) as b:
        r = _get(b.base, "/ai/config")
        assert r["data"]["enabled"] is True
        assert r["data"]["base_url"] == "http://seed/v1"
        assert r["data"]["key_set"] is True
        assert "api_key" not in r["data"]


def test_corrupt_config_recovers():
    import tempfile
    import shutil as _sh
    home = tempfile.mkdtemp(prefix="pepper-home-")
    cfg_dir = os.path.join(home, ".pepper-studio")
    os.makedirs(cfg_dir)
    with open(os.path.join(cfg_dir, "ai.json"), "w") as f:
        f.write("{ not json")
    try:
        with bridge_proc(home=home) as b:
            r = _get(b.base, "/ai/config")
            assert r["success"] and r["data"]["enabled"] is False
            assert os.path.exists(os.path.join(cfg_dir, "ai.json.bad"))
    finally:
        _sh.rmtree(home, ignore_errors=True)
