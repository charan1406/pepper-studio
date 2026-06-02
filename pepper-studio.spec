# PyInstaller spec — Pepper Studio "localhost app" (onedir).
# Build:  .buildvenv/bin/pyinstaller pepper-studio.spec --noconfirm
# Output: dist/pepper-studio/  (folder with the executable + _internal/)
#
# Bundles the bridge + the prebuilt web UI. Ships NO model weights and NO
# inference binary (lean cross-platform packaging — see CLAUDE.md). cv2/pyaudio/
# numpy are intentionally NOT installed in the build venv, so the base build is
# lean by construction; they stay optional ("enable hardware" extra).

block_cipher = None

a = Analysis(
    ['simulator/sim_bridge.py'],
    pathex=['simulator'],                       # find top-level llm/ai_config/runner/sim_state
    binaries=[],
    datas=[('simulator/web/dist', 'web/dist')], # -> sys._MEIPASS/web/dist
    hiddenimports=['websockets', 'websockets.sync.server'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['cv2', 'pyaudio', 'numpy', 'tkinter', 'PIL', 'matplotlib'],
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
    name='pepper-studio',
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
    name='pepper-studio',
)
