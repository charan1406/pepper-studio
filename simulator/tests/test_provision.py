import io
import os
import sys
import tarfile
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import provision  # noqa: E402

# Real asset list from llama.cpp release b9673 (the pinned build).
ASSETS = [
    "cudart-llama-bin-win-cuda-12.4-x64.zip",
    "cudart-llama-bin-win-cuda-13.3-x64.zip",
    "llama-b9673-bin-android-arm64.tar.gz",
    "llama-b9673-bin-macos-arm64.tar.gz",
    "llama-b9673-bin-macos-x64.tar.gz",
    "llama-b9673-bin-ubuntu-arm64.tar.gz",
    "llama-b9673-bin-ubuntu-openvino-2026.0-x64.tar.gz",
    "llama-b9673-bin-ubuntu-rocm-7.2-x64.tar.gz",
    "llama-b9673-bin-ubuntu-s390x.tar.gz",
    "llama-b9673-bin-ubuntu-sycl-fp32-x64.tar.gz",
    "llama-b9673-bin-ubuntu-vulkan-arm64.tar.gz",
    "llama-b9673-bin-ubuntu-vulkan-x64.tar.gz",
    "llama-b9673-bin-ubuntu-x64.tar.gz",
    "llama-b9673-bin-win-cpu-arm64.zip",
    "llama-b9673-bin-win-cpu-x64.zip",
    "llama-b9673-bin-win-cuda-12.4-x64.zip",
    "llama-b9673-bin-win-cuda-13.3-x64.zip",
    "llama-b9673-bin-win-hip-radeon-x64.zip",
    "llama-b9673-bin-win-opencl-adreno-arm64.zip",
    "llama-b9673-bin-win-sycl-x64.zip",
    "llama-b9673-bin-win-vulkan-x64.zip",
    "llama-b9673-xcframework.zip",
]


def setup_function():
    provision._reset_for_test()


# ─── detect_backend ───────────────────────────────────────────────────────────

def test_apple_silicon_is_metal():
    assert provision.detect_backend(system="Darwin", machine="arm64") == "metal"


def test_intel_mac_is_cpu():
    assert provision.detect_backend(system="Darwin", machine="x86_64") == "cpu"


def test_linux_with_gpu_defaults_vulkan():
    assert provision.detect_backend(system="Linux", machine="x86_64", has_gpu=True) == "vulkan"


def test_linux_without_gpu_is_cpu():
    assert provision.detect_backend(system="Linux", machine="x86_64", has_gpu=False) == "cpu"


def test_override_wins_over_autodetect():
    assert provision.detect_backend(override="cuda", system="Linux", has_gpu=True) == "cuda"
    assert provision.detect_backend(override="CPU", system="Darwin", machine="arm64") == "cpu"


# ─── pick_asset ───────────────────────────────────────────────────────────────

def test_pick_linux_vulkan_x64():
    assert provision.pick_asset(ASSETS, "Linux", "x86_64", "vulkan") == \
        "llama-b9673-bin-ubuntu-vulkan-x64.tar.gz"


def test_pick_linux_cpu_is_plain_build_not_a_gpu_variant():
    got = provision.pick_asset(ASSETS, "Linux", "x86_64", "cpu")
    assert got == "llama-b9673-bin-ubuntu-x64.tar.gz"
    assert not any(t in got for t in provision._GPU_TOKENS)


def test_pick_macos_metal_is_plain_arm64():
    assert provision.pick_asset(ASSETS, "Darwin", "arm64", "metal") == \
        "llama-b9673-bin-macos-arm64.tar.gz"


def test_pick_windows_cpu_uses_cpu_token():
    assert provision.pick_asset(ASSETS, "Windows", "AMD64", "cpu") == \
        "llama-b9673-bin-win-cpu-x64.zip"


def test_pick_windows_cuda_prefers_lower_version():
    # _best sorts ascending -> 12.4 before 13.3 (broader driver compat).
    assert provision.pick_asset(ASSETS, "Windows", "AMD64", "cuda") == \
        "llama-b9673-bin-win-cuda-12.4-x64.zip"


def test_pick_windows_cuda_does_not_match_cudart():
    got = provision.pick_asset(ASSETS, "Windows", "AMD64", "cuda")
    assert not got.startswith("cudart-")


def test_pick_windows_vulkan():
    assert provision.pick_asset(ASSETS, "Windows", "AMD64", "vulkan") == \
        "llama-b9673-bin-win-vulkan-x64.zip"


def test_no_linux_cuda_asset_returns_none():
    assert provision.pick_asset(ASSETS, "Linux", "x86_64", "cuda") is None


def test_cudart_asset_matches_arch():
    assert provision.cudart_asset(ASSETS, "AMD64") == "cudart-llama-bin-win-cuda-12.4-x64.zip"


# ─── extract safety ───────────────────────────────────────────────────────────

def test_extract_rejects_zip_traversal(tmp_path):
    bad = tmp_path / "evil.zip"
    with zipfile.ZipFile(bad, "w") as z:
        z.writestr("../escape.txt", "x")
    import pytest
    with pytest.raises(ValueError):
        provision.extract(str(bad), str(tmp_path / "out"))


def test_extract_tar_gz(tmp_path):
    arc = tmp_path / "b.tar.gz"
    with tarfile.open(arc, "w:gz") as t:
        info = tarfile.TarInfo("build/bin/llama-server")
        data = b"#!/bin/sh\n"
        info.size = len(data)
        t.addfile(info, io.BytesIO(data))
    out = tmp_path / "out"
    provision.extract(str(arc), str(out))
    assert provision.find_llama_server(str(out)).endswith("llama-server")


# ─── orchestration (offline, fake opener) ─────────────────────────────────────

class _FakeResp:
    def __init__(self, data, headers=None):
        self._b = io.BytesIO(data)
        self.headers = headers or {}

    def read(self, n=-1):
        return self._b.read(n)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _make_linux_vulkan_tar():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t:
        info = tarfile.TarInfo("build/bin/llama-server")
        data = b"#!/bin/sh\necho llama\n"
        info.size = len(data)
        t.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def test_provision_end_to_end_linux_vulkan(tmp_path, monkeypatch):
    monkeypatch.setattr(provision, "LLAMA_DIR", str(tmp_path / "llama"))
    monkeypatch.setattr(provision, "MODELS_DIR", str(tmp_path / "models"))
    monkeypatch.setattr(provision.platform, "system", lambda: "Linux")
    monkeypatch.setattr(provision.platform, "machine", lambda: "x86_64")

    tar_bytes = _make_linux_vulkan_tar()

    def fake_opener(req, *a, **k):
        url = req.full_url if hasattr(req, "full_url") else req
        if url.endswith(".gguf?download=true") or url.endswith(".gguf"):
            return _FakeResp(b"GGUF\x00fake", {"Content-Length": "9"})
        return _FakeResp(tar_bytes, {"Content-Length": str(len(tar_bytes))})

    res = provision.provision(
        backend="vulkan",
        list_assets=lambda opener: ASSETS,
        opener=fake_opener,
    )
    assert res["state"] == "done", res
    assert res["binary"].endswith("llama-server")
    assert os.path.isfile(res["binary"])
    assert res["gguf"].endswith(".gguf")
    assert os.path.isfile(res["gguf"])


def test_provision_linux_cuda_fails_clearly(monkeypatch):
    monkeypatch.setattr(provision.platform, "system", lambda: "Linux")
    monkeypatch.setattr(provision.platform, "machine", lambda: "x86_64")
    res = provision.provision(backend="cuda", list_assets=lambda opener: ASSETS,
                              opener=lambda *a, **k: None)
    assert res["state"] == "error"
    assert "vulkan" in res["error"].lower()


def test_provision_is_idempotent_skips_existing(tmp_path, monkeypatch):
    monkeypatch.setattr(provision, "LLAMA_DIR", str(tmp_path / "llama"))
    monkeypatch.setattr(provision, "MODELS_DIR", str(tmp_path / "models"))
    monkeypatch.setattr(provision.platform, "system", lambda: "Linux")
    monkeypatch.setattr(provision.platform, "machine", lambda: "x86_64")

    # Pre-place a binary + model so provision should download nothing.
    bdir = tmp_path / "llama" / "vulkan" / "bin"
    bdir.mkdir(parents=True)
    (bdir / "llama-server").write_text("#!/bin/sh\n")
    (tmp_path / "models").mkdir()
    (tmp_path / "models" / provision.DEFAULT_MODEL["name"]).write_text("x")

    def boom(*a, **k):
        raise AssertionError("should not download when already provisioned")

    res = provision.provision(backend="vulkan", list_assets=lambda opener: ASSETS, opener=boom)
    assert res["state"] == "done", res
