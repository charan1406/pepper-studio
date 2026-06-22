# PyInstaller spec — Pepper Studio "localhost app" (onedir).
#
# TWO builds, selected by the PEPPER_BUNDLE env var:
#   PEPPER_BUNDLE=lean  (default) -> dist/pepper-studio/        (heavy, ~300-500 MB)
#       Full app: bridge + UI + paramiko (robot) + search + in-app voice (STT).
#       MINUS the LLM — bring your own llama-server / Ollama / cloud key.
#   PEPPER_BUNDLE=full            -> dist/pepper-studio-full/   (same size on disk)
#       Lean PLUS first-run auto-download of a prebuilt llama.cpp binary
#       (Vulkan default / CUDA override / Metal / CPU) and a recommended GGUF.
#
# Both builds carry the same code; the ONLY difference is bundle.json, which
# flips the first-run provisioning UI on for "full". provision.py is stdlib-only
# and ships in both (inert without the marker). Still NO weights / inference
# binary baked in — "full" downloads them at runtime (see CLAUDE.md reversal).
#
# Build (run on the TARGET OS — PyInstaller can't cross-compile):
#   PEPPER_BUNDLE=lean pyinstaller pepper-studio.spec --noconfirm   (or ./build.sh lean)
#   PEPPER_BUNDLE=full pyinstaller pepper-studio.spec --noconfirm   (or ./build.sh full)

import json
import os
import tempfile
from PyInstaller.utils.hooks import (
    collect_data_files, collect_dynamic_libs, collect_submodules)

BUNDLE = os.environ.get("PEPPER_BUNDLE", "lean").lower()
if BUNDLE not in ("lean", "full"):
    raise SystemExit(f"PEPPER_BUNDLE must be lean|full, got {BUNDLE!r}")
block_cipher = None


def _safe(fn, pkg):
    """Tolerate a package being absent from the build venv (returns [])."""
    try:
        return fn(pkg)
    except Exception:
        return []


hiddenimports = ['websockets', 'websockets.sync.server']
hiddenimports += _safe(collect_submodules, 'paramiko')   # robot connection — both builds
datas = [('simulator/web/dist', 'web/dist')]             # -> sys._MEIPASS/web/dist
binaries = []

# Voice STT ships in BOTH builds now. numpy stays IN (faster-whisper/ctranslate2 need it).
excludes = ['cv2', 'pyaudio', 'tkinter', 'PIL', 'matplotlib', 'torch', 'transformers']
for pkg in ('faster_whisper', 'ctranslate2', 'av', 'onnxruntime',
            'tokenizers', 'huggingface_hub'):
    datas += _safe(collect_data_files, pkg)
    binaries += _safe(collect_dynamic_libs, pkg)
    hiddenimports += _safe(collect_submodules, pkg)

# Bundle marker -> sys._MEIPASS/bundle.json, read at runtime by sim_bridge.
_marker_dir = os.path.join(tempfile.gettempdir(), 'pepper-studio-marker')
os.makedirs(_marker_dir, exist_ok=True)
with open(os.path.join(_marker_dir, 'bundle.json'), 'w') as _mf:
    json.dump({'bundle': BUNDLE}, _mf)
datas += [(os.path.join(_marker_dir, 'bundle.json'), '.')]

app_name = 'pepper-studio' if BUNDLE == 'lean' else 'pepper-studio-full'

a = Analysis(
    ['simulator/sim_bridge.py'],
    pathex=['simulator'],                       # find top-level llm/ai_config/runner/connection/...
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=app_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,                                # it's a server: print logs, open browser
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name=app_name,
)
