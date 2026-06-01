import os
import stat
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ai_config


def _point_at(tmp_path, monkeypatch):
    cfg_dir = tmp_path / ".pepper-studio"
    monkeypatch.setattr(ai_config, "CONFIG_DIR", str(cfg_dir))
    monkeypatch.setattr(ai_config, "CONFIG_PATH", str(cfg_dir / "ai.json"))
    return cfg_dir


def test_save_then_load_roundtrip(tmp_path, monkeypatch):
    _point_at(tmp_path, monkeypatch)
    assert ai_config.save({"base_url": "http://x/v1", "api_key": "k", "model": "m", "timeout": 30})
    cfg = ai_config.load()
    assert cfg["base_url"] == "http://x/v1"
    assert cfg["api_key"] == "k"
    assert cfg["model"] == "m"
    assert cfg["timeout"] == 30


def test_saved_file_is_0600(tmp_path, monkeypatch):
    _point_at(tmp_path, monkeypatch)
    ai_config.save({"base_url": "http://x/v1"})
    mode = stat.S_IMODE(os.stat(ai_config.CONFIG_PATH).st_mode)
    assert mode == 0o600


def test_no_file_seeds_from_env(tmp_path, monkeypatch):
    _point_at(tmp_path, monkeypatch)
    monkeypatch.setenv("SIM_AI_BASE_URL", "http://seed/v1")
    monkeypatch.setenv("SIM_AI_API_KEY", "seedkey")
    cfg = ai_config.load()
    assert cfg["base_url"] == "http://seed/v1"
    assert cfg["api_key"] == "seedkey"


def test_corrupt_file_backs_up_and_defaults(tmp_path, monkeypatch):
    cfg_dir = _point_at(tmp_path, monkeypatch)
    cfg_dir.mkdir(parents=True)
    (cfg_dir / "ai.json").write_text("{ not valid json")
    monkeypatch.delenv("SIM_AI_BASE_URL", raising=False)
    cfg = ai_config.load()
    assert cfg["base_url"] == ""           # no env set → defaults
    assert (cfg_dir / "ai.json.bad").exists()


def test_corrupt_file_falls_back_to_env(tmp_path, monkeypatch):
    cfg_dir = _point_at(tmp_path, monkeypatch)
    cfg_dir.mkdir(parents=True)
    (cfg_dir / "ai.json").write_text("{ not valid json")
    monkeypatch.setenv("SIM_AI_BASE_URL", "http://recovered/v1")
    cfg = ai_config.load()
    assert cfg["base_url"] == "http://recovered/v1"   # env honored, not dropped
    assert (cfg_dir / "ai.json.bad").exists()


def test_load_coerces_string_timeout(tmp_path, monkeypatch):
    cfg_dir = _point_at(tmp_path, monkeypatch)
    cfg_dir.mkdir(parents=True)
    (cfg_dir / "ai.json").write_text('{"base_url": "http://x/v1", "timeout": "45"}')
    cfg = ai_config.load()
    assert cfg["timeout"] == 45


def test_save_returns_false_when_unwritable(tmp_path, monkeypatch):
    _point_at(tmp_path, monkeypatch)

    def _raise(*a, **k):
        raise OSError("nope")

    monkeypatch.setattr(ai_config.os, "makedirs", _raise)
    assert ai_config.save({"base_url": "http://x/v1"}) is False


def test_log_api_call_redacts_api_key():
    from sim_state import PepperState
    p = PepperState()
    body = {"base_url": "http://x/v1", "api_key": "supersecret"}
    p.log_api_call("/ai/config", "POST", body=body, response={"success": True})
    entry = p.api_log[-1]
    assert entry["body"]["api_key"] == "***"
    assert entry["body"]["base_url"] == "http://x/v1"
    assert body["api_key"] == "supersecret"  # original dict not mutated
