"""First-run LLM provisioning for the "full" bundle. Stdlib only.

The lean build is bring-your-own (per CLAUDE.md). The "full" build deliberately
OVERRIDES that pillar: on first run it auto-downloads a prebuilt llama.cpp server
binary (matched to the host GPU backend) plus a recommended GGUF, writes
runner.json, then hands off to the existing runner.py sidecar. No compiling.

Backend policy (decided 2026-06-17):
  - Vulkan is the DEFAULT GPU backend — cross-vendor (NVIDIA/AMD/Intel), no CUDA
    toolkit, and the only GPU prebuilt llama.cpp ships for Linux.
  - CUDA is a manual override, Windows-only (no ubuntu-cuda asset exists). It also
    needs the matching cudart runtime zip.
  - Apple Silicon -> Metal (built into the macos-arm64 build, no separate asset).
  - Fallback -> CPU.

Network (opener) and the runner are injected so tests run fully offline.
"""
import json
import os
import platform
import shutil
import tarfile
import threading
import urllib.request
import zipfile
from collections import deque

CACHE_DIR = os.path.join(os.path.expanduser("~"), ".pepper-studio")
LLAMA_DIR = os.path.join(CACHE_DIR, "llama")
MODELS_DIR = os.path.join(CACHE_DIR, "models")

# Pinned for reproducibility; overridable via provision(build=...).
LLAMA_REPO = "ggml-org/llama.cpp"
LLAMA_BUILD = "b9673"
RELEASE_BASE = f"https://github.com/{LLAMA_REPO}/releases/download/{LLAMA_BUILD}"

# Recommended default brain: small, fast, solid tool-calling, runs on CPU.
DEFAULT_MODEL = {
    "name": "qwen2.5-3b-instruct-q4_k_m.gguf",
    "url": "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/"
           "qwen2.5-3b-instruct-q4_k_m.gguf?download=true",
}

# Tokens that mark a NON-cpu / non-target asset. Used to pick the plain CPU build.
_GPU_TOKENS = ("vulkan", "cuda", "rocm", "hip", "sycl", "openvino", "opencl",
               "cudart", "s390x", "android", "xcframework")


def detect_backend(override=None, system=None, machine=None, has_gpu=None):
    """Resolve the llama.cpp backend to fetch.

    override: force a backend ("vulkan"|"cuda"|"metal"|"cpu"|"rocm"|"sycl").
    has_gpu:  None -> probe the host; bool -> caller-supplied (tests).
    """
    system = system or platform.system()
    machine = (machine or platform.machine()).lower()
    is_apple_silicon = system == "Darwin" and machine in ("arm64", "aarch64")

    if override:
        return override.lower()
    if is_apple_silicon:
        return "metal"            # built into the macos-arm64 build
    if system == "Darwin":
        return "cpu"              # Intel Macs: Metal not worth a separate path
    if has_gpu is None:
        has_gpu = _probe_gpu(system)
    return "vulkan" if has_gpu else "cpu"


def _probe_gpu(system):
    """Cheap best-effort GPU presence check. Vulkan covers any vendor, so we only
    need 'is there a discrete/integrated GPU worth offloading to'."""
    try:
        if system == "Linux":
            # Any DRI render node => a GPU the Vulkan ICD can likely use.
            return os.path.isdir("/dev/dri") and bool(
                [f for f in os.listdir("/dev/dri") if f.startswith("render")])
        if system == "Windows":
            return shutil.which("nvidia-smi") is not None or _wmi_has_gpu()
    except OSError:
        pass
    return False


def _wmi_has_gpu():
    try:
        import subprocess
        out = subprocess.run(
            ["wmic", "path", "win32_VideoController", "get", "name"],
            capture_output=True, text=True, timeout=5)
        return "vulkan" in out.stdout.lower() or len(out.stdout.split("\n")) > 2
    except Exception:
        return True  # can't tell on Windows -> assume GPU, Vulkan loader will validate


def _arch_token(machine):
    return "arm64" if machine.lower() in ("arm64", "aarch64") else "x64"


def _os_token(system):
    return {"Darwin": "macos", "Linux": "ubuntu", "Windows": "win"}.get(system)


def pick_asset(names, system, machine, backend):
    """Pure: choose the llama.cpp binary asset matching host + backend.

    Returns the asset filename or None. Token-matched (not name-constructed) so it
    survives version suffixes like 'cuda-12.4', 'rocm-7.2', 'sycl-fp32'.
    """
    os_tok = _os_token(system)
    arch_tok = _arch_token(machine)
    if not os_tok:
        return None

    def host_match(n):
        return (n.startswith("llama-") and f"-{os_tok}-" in n
                and (f"-{arch_tok}." in n or n.endswith(f"-{arch_tok}.tar.gz")
                     or n.endswith(f"-{arch_tok}.zip"))
                and not n.startswith("cudart-"))

    cands = [n for n in names if host_match(n)]
    if not cands:
        return None

    if backend in ("cpu", "metal"):
        # Plain build: host+arch with no GPU/special token. (Windows uses "cpu".)
        if os_tok == "win":
            hits = [n for n in cands if "-cpu-" in n]
        else:
            hits = [n for n in cands if not any(t in n for t in _GPU_TOKENS)]
        return _best(hits)

    # GPU backends: require the backend token. "cuda" must not match "cudart"
    # (already excluded) and prefers the lowest version for driver compatibility.
    tok = {"vulkan": "vulkan", "cuda": "cuda", "rocm": "rocm",
           "hip": "hip", "sycl": "sycl"}.get(backend, backend)
    hits = [n for n in cands if f"-{tok}" in n]
    return _best(hits)


def _best(names):
    """Stable pick: prefer the lowest embedded version number (compat), else first."""
    if not names:
        return None
    return sorted(names)[0]


def cudart_asset(names, machine):
    """Windows CUDA needs the matching cudart runtime zip alongside the binary."""
    arch_tok = _arch_token(machine)
    hits = [n for n in names if n.startswith("cudart-") and f"-{arch_tok}." in n]
    return _best(hits)


def asset_url(name):
    return f"{RELEASE_BASE}/{name}"


# ─── download / extract ──────────────────────────────────────────────────────

def download(url, dest, opener=urllib.request.urlopen, on_progress=None, chunk=1 << 16):
    """Stream a URL to dest (atomic via .part). on_progress(done, total|None)."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": "pepper-studio"})
    with opener(req) as r:
        total = int(r.headers.get("Content-Length") or 0) or None
        done = 0
        with open(tmp, "wb") as f:
            while True:
                buf = r.read(chunk)
                if not buf:
                    break
                f.write(buf)
                done += len(buf)
                if on_progress:
                    on_progress(done, total)
    os.replace(tmp, dest)
    return dest


def extract(archive, dest_dir):
    """Unpack a .zip or .tar.gz into dest_dir. Rejects path-traversal members."""
    os.makedirs(dest_dir, exist_ok=True)
    if archive.endswith(".zip"):
        with zipfile.ZipFile(archive) as z:
            _safe_extract_zip(z, dest_dir)
    elif archive.endswith((".tar.gz", ".tgz")):
        with tarfile.open(archive, "r:gz") as t:
            _safe_extract_tar(t, dest_dir)
    else:
        raise ValueError(f"unsupported archive: {archive}")
    return dest_dir


def _within(base, target):
    base = os.path.realpath(base)
    return os.path.realpath(target).startswith(base + os.sep)


def _safe_extract_zip(z, dest):
    for m in z.namelist():
        out = os.path.join(dest, m)
        if not _within(dest, out):
            raise ValueError(f"unsafe path in zip: {m}")
    z.extractall(dest)


def _safe_extract_tar(t, dest):
    for m in t.getmembers():
        out = os.path.join(dest, m.name)
        if not _within(dest, out):
            raise ValueError(f"unsafe path in tar: {m.name}")
    t.extractall(dest)


def find_llama_server(root):
    """Locate the llama-server binary anywhere under root (layout varies by build)."""
    names = ("llama-server", "llama-server.exe")
    for dirpath, _dirs, files in os.walk(root):
        for n in names:
            if n in files:
                p = os.path.join(dirpath, n)
                try:
                    os.chmod(p, 0o755)
                except OSError:
                    pass
                return p
    return None


# ─── orchestration ───────────────────────────────────────────────────────────

_lock = threading.Lock()
_state = {
    "state": "idle",        # idle | running | done | error
    "step": "",
    "progress": 0.0,        # 0..1 for the current download
    "backend": "",
    "binary": "",
    "gguf": "",
    "error": None,
    "log": deque(maxlen=200),
}


def status():
    with _lock:
        s = dict(_state)
        s["log"] = list(_state["log"])
        return s


def _log(msg):
    with _lock:
        _state["log"].append(msg)


def _set(**kw):
    with _lock:
        _state.update(kw)


def is_provisioned():
    """True if a usable binary + model already exist (skip re-provisioning)."""
    have_bin = bool(find_llama_server(LLAMA_DIR)) if os.path.isdir(LLAMA_DIR) else False
    have_model = os.path.isdir(MODELS_DIR) and any(
        f.endswith(".gguf") for f in os.listdir(MODELS_DIR))
    return have_bin and have_model


def provision(backend=None, model=None, build=None, list_assets=None,
              opener=urllib.request.urlopen, on_step=None):
    """Fetch llama.cpp binary + model, write runner.json, return a status dict.

    backend: None -> auto-detect (Vulkan default). list_assets: callable returning
    the release asset-name list (injected in tests). Idempotent: skips a step whose
    output already exists.
    """
    global RELEASE_BASE
    if build:
        RELEASE_BASE = f"https://github.com/{LLAMA_REPO}/releases/download/{build}"
    model = model or DEFAULT_MODEL
    bk = detect_backend(override=backend)
    _set(state="running", step="resolve", backend=bk, error=None, progress=0.0)
    _log(f"backend: {bk}")

    system, machine = platform.system(), platform.machine()
    if system == "Linux" and bk == "cuda":
        return _fail("no prebuilt Linux CUDA llama.cpp exists — use vulkan instead")

    try:
        names = (list_assets or _fetch_asset_names)(opener)
    except Exception as e:                                   # noqa: BLE001
        return _fail(f"could not list llama.cpp release assets: {e}")

    asset = pick_asset(names, system, machine, bk)
    if not asset:
        return _fail(f"no llama.cpp asset for {system}/{machine}/{bk}")
    _log(f"binary asset: {asset}")

    # 1) binary
    bin_dir = os.path.join(LLAMA_DIR, bk)
    server = find_llama_server(bin_dir)
    if not server:
        _set(step="download-binary", progress=0.0)
        if on_step:
            on_step("download-binary")
        arc = os.path.join(LLAMA_DIR, asset)
        download(asset_url(asset), arc, opener=opener,
                 on_progress=lambda d, t: _set(progress=(d / t) if t else 0.0))
        _set(step="extract-binary")
        extract(arc, bin_dir)
        os.remove(arc)
        if system == "Windows" and bk == "cuda":
            cu = cudart_asset(names, machine)
            if cu:
                _log(f"cudart asset: {cu}")
                carc = os.path.join(LLAMA_DIR, cu)
                download(asset_url(cu), carc, opener=opener)
                extract(carc, bin_dir)   # DLLs sit next to llama-server.exe
                os.remove(carc)
        server = find_llama_server(bin_dir)
    if not server:
        return _fail("llama-server not found in the downloaded archive")
    _log(f"binary: {server}")

    # 2) model
    gguf = os.path.join(MODELS_DIR, model["name"])
    if not os.path.isfile(gguf):
        _set(step="download-model", progress=0.0)
        if on_step:
            on_step("download-model")
        download(model["url"], gguf, opener=opener,
                 on_progress=lambda d, t: _set(progress=(d / t) if t else 0.0))
    _log(f"model: {gguf}")

    _set(state="done", step="done", progress=1.0, binary=server, gguf=gguf)
    return status()


def _fetch_asset_names(opener):
    api = f"https://api.github.com/repos/{LLAMA_REPO}/releases/tags/{LLAMA_BUILD}"
    req = urllib.request.Request(api, headers={"User-Agent": "pepper-studio",
                                               "Accept": "application/vnd.github+json"})
    with opener(req) as r:
        data = json.load(r)
    return [a["name"] for a in data.get("assets", [])]


def _fail(msg):
    _set(state="error", error=msg)
    _log(f"ERROR: {msg}")
    return status()


def _reset_for_test():
    with _lock:
        _state.update(state="idle", step="", progress=0.0, backend="",
                      binary="", gguf="", error=None)
        _state["log"].clear()
