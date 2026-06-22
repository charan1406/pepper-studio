#!/usr/bin/env bash
# Build a Pepper Studio onedir bundle. PyInstaller can't cross-compile, so run
# this ON the target OS. Output: dist/pepper-studio (lean) or dist/pepper-studio-full.
#
#   ./build.sh         # lean (default): full app incl. voice (STT), no LLM (BYO server)
#   ./build.sh full    # full: lean + first-run auto-download of llama.cpp + a GGUF
#
# Both builds carry voice; "full" only adds bundle.json to flip on the first-run
# provisioning UI. So the dependency set is identical — the spec handles the rest.
set -euo pipefail

MODE="${1:-lean}"
case "$MODE" in lean|full) ;; *) echo "usage: $0 [lean|full]"; exit 1 ;; esac

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "== build web UI =="
(cd simulator/web && npm ci && npm run build)

VENV=".buildvenv-$MODE"
echo "== build venv: $VENV =="
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip pyinstaller websockets paramiko faster-whisper

echo "== pyinstaller ($MODE) =="
PEPPER_BUNDLE="$MODE" "$VENV/bin/pyinstaller" pepper-studio.spec --noconfirm

OUT="dist/pepper-studio"; [ "$MODE" = "full" ] && OUT="dist/pepper-studio-full"
echo "== built: $OUT =="
echo "   smoke test:  SIM_OPEN_BROWSER=0 $OUT/$(basename "$OUT") &  then curl localhost:5001/ai/config"
