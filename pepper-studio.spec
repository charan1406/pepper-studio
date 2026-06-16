# PyInstaller spec — Pepper Studio "localhost app" (onedir).
#
# TWO builds, selected by the PEPPER_BUNDLE env var:
#   PEPPER_BUNDLE=lean  (default) -> dist/pepper-studio/         (~40 MB)
#       bridge + prebuilt web UI + paramiko (robot connection over SSH).
#       NO STT / numpy / inference deps. Manual control, services, llama all work.
#   PEPPER_BUNDLE=voice           -> dist/pepper-studio-voice/   (heavy, +~300-500 MB)
#       everything in lean PLUS in-app speech-to-text
#       (faster-whisper / ctranslate2 / numpy / av / onnxruntime).
#
# Build (run on the TARGET OS — PyInstaller can't cross-compile):
#   PEPPER_BUNDLE=lean  pyinstaller pepper-studio.spec --noconfirm
#   PEPPER_BUNDLE=voice pyinstaller pepper-studio.spec --noconfirm
#   (or use ./build.sh lean | ./build.sh voice)
#
# Ships NO model weights and NO inference binary (lean pillar — see CLAUDE.md).
# The voice build still downloads whisper weights on first use, not at bundle time.

import os
from PyInstaller.utils.hooks import (
    collect_data_files, collect_dynamic_libs, collect_submodules)

VOICE = os.environ.get("PEPPER_BUNDLE", "lean").lower() == "voice"
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

if VOICE:
    # In-app STT. numpy stays IN (faster-whisper / ctranslate2 require it).
    excludes = ['cv2', 'pyaudio', 'tkinter', 'PIL', 'matplotlib', 'torch', 'transformers']
    for pkg in ('faster_whisper', 'ctranslate2', 'av', 'onnxruntime',
                'tokenizers', 'huggingface_hub'):
        datas += _safe(collect_data_files, pkg)
        binaries += _safe(collect_dynamic_libs, pkg)
        hiddenimports += _safe(collect_submodules, pkg)
    app_name = 'pepper-studio-voice'
else:
    # Lean: heavy numerical/STT deps stay out (and aren't installed in the venv).
    excludes = ['cv2', 'pyaudio', 'numpy', 'tkinter', 'PIL', 'matplotlib',
                'faster_whisper', 'ctranslate2', 'av', 'onnxruntime', 'torch', 'transformers']
    app_name = 'pepper-studio'

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
