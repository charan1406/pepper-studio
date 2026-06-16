#!/usr/bin/env bash
# Build a Pepper Studio onedir bundle. PyInstaller can't cross-compile, so run
# this ON the target OS. Output: dist/pepper-studio (lean) or dist/pepper-studio-voice.
#
#   ./build.sh         # lean  (default): bridge + UI + robot connection (paramiko)
#   ./build.sh voice   # voice: lean + in-app speech-to-text (faster-whisper)
set -euo pipefail

MODE="${1:-lean}"
case "$MODE" in lean|voice) ;; *) echo "usage: $0 [lean|voice]"; exit 1 ;; esac

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "== build web UI =="
(cd simulator/web && npm ci && npm run build)

VENV=".buildvenv-$MODE"
echo "== build venv: $VENV =="
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip pyinstaller websockets paramiko
[ "$MODE" = "voice" ] && "$VENV/bin/pip" install faster-whisper

echo "== pyinstaller ($MODE) =="
PEPPER_BUNDLE="$MODE" "$VENV/bin/pyinstaller" pepper-studio.spec --noconfirm

OUT="dist/pepper-studio"; [ "$MODE" = "voice" ] && OUT="dist/pepper-studio-voice"
echo "== built: $OUT =="
echo "   smoke test:  SIM_OPEN_BROWSER=0 $OUT/$(basename "$OUT") &  then curl localhost:5001/ai/config"
