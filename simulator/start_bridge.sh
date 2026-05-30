#!/bin/bash
# Pepper Studio — Simulator Setup & Launch
# Creates a local venv, installs core deps, and starts the bridge (which also
# serves the 3D web UI on http://localhost:5001). Pass --hardware to also
# install the optional webcam/mic deps (opencv-python, numpy, pyaudio).
# For Arch Linux (and any PEP 668 compliant distro).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"

echo "============================================"
echo "  Pepper Studio — Simulator Setup"
echo "============================================"

if [ ! -d "$VENV_DIR" ]; then
    echo "[1/3] Creating virtual environment..."
    python -m venv "$VENV_DIR"
else
    echo "[1/3] Virtual environment exists."
fi

echo "[2/3] Installing core dependencies..."
source "$VENV_DIR/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$SCRIPT_DIR/requirements.txt"
if [ "$1" = "--hardware" ]; then
    echo "      + optional hardware deps (webcam/mic)..."
    pip install --quiet opencv-python numpy pyaudio || \
        echo "[WARN] optional hardware deps failed — sim still runs (placeholder cam, silent mic)"
fi

echo "[3/3] Starting simulator bridge (API + 3D UI on http://localhost:5001)..."
echo ""
cd "$SCRIPT_DIR"
python sim_bridge.py
