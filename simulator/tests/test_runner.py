import os
import stat
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import runner


def _point_at(tmp_path, monkeypatch):
    cfg_dir = tmp_path / ".pepper-studio"
    monkeypatch.setattr(runner, "CONFIG_DIR", str(cfg_dir))
    monkeypatch.setattr(runner, "CONFIG_PATH", str(cfg_dir / "runner.json"))


def test_list_models_only_gguf(tmp_path):
    (tmp_path / "a.gguf").write_text("x")
    (tmp_path / "b.gguf").write_text("x")
    (tmp_path / "c.txt").write_text("x")
    assert runner.list_models(str(tmp_path)) == ["a.gguf", "b.gguf"]


def test_list_models_missing_dir():
    assert runner.list_models("/no/such/dir") == []


def test_build_argv_includes_only_set_flags():
    argv = runner.build_argv("llama-server", "/m.gguf", 5999,
                             {"ngl": 20, "ctx": 4096, "cache_type": "q8_0",
                              "flash_attn": True, "mmproj": "", "extra_args": "--threads 6"})
    assert argv[:7] == ["llama-server", "--model", "/m.gguf", "--host", "127.0.0.1", "--port", "5999"]
    assert "-ngl" in argv and "20" in argv
    assert "-c" in argv and "4096" in argv
    assert argv.count("--cache-type-k") == 1 and argv.count("--cache-type-v") == 1
    assert "-fa" in argv
    assert "--threads" in argv and "6" in argv
    assert "--mmproj" not in argv  # empty → omitted


def test_build_argv_omits_unset():
    argv = runner.build_argv("llama-server", "/m.gguf", 1, {})
    assert "-ngl" not in argv and "-c" not in argv and "-fa" not in argv


def test_save_load_roundtrip_0600(tmp_path, monkeypatch):
    _point_at(tmp_path, monkeypatch)
    assert runner.save({"models_dir": "/m", "binary": "/b", "gguf": "x.gguf", "flags": {"ngl": 10}})
    cfg = runner.load()
    assert cfg["models_dir"] == "/m" and cfg["binary"] == "/b"
    assert cfg["flags"] == {"ngl": 10}
    mode = stat.S_IMODE(os.stat(runner.CONFIG_PATH).st_mode)
    assert mode == 0o600


def test_resolve_binary_prefers_configured(tmp_path, monkeypatch):
    fake = tmp_path / "llama-server"
    fake.write_text("#!/bin/sh\n")
    os.chmod(fake, 0o755)
    assert runner.resolve_binary(str(fake)) == str(fake)
    assert runner.resolve_binary("/nonexistent/llama-server") in (None, __import__("shutil").which("llama-server"))
