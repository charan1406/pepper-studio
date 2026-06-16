#!/usr/bin/env bash
# Bring up the full Pepper voice stack from the LAPTOP and start the voice loop.
#
# Two machines:
#   - the ROBOT runs pepper/bridge.py  (start it there first — see the message
#     this script prints if the bridge is down).
#   - this LAPTOP runs llama-server + SearXNG + the voice loop.
#
# Idempotent: re-run anytime. Already-running pieces are reused, not restarted.
# Every chat turn is echoed to the screen AND saved to a timestamped transcript.
#
# Override any path by exporting it first, e.g.:
#   MODEL=~/models/other.gguf ROBOT_IP=192.168.1.20 ./run_voice_stack.sh
set -euo pipefail

# ── config (override via environment) ────────────────────────────────
ROBOT_IP="${ROBOT_IP:-192.168.1.17}"
BRIDGE_URL="${BRIDGE_URL:-http://$ROBOT_IP:5001}"

LLAMA_DIR="${LLAMA_DIR:-$HOME/llama-b9587}"
LLAMA_BIN="${LLAMA_BIN:-$LLAMA_DIR/llama-server}"
MODEL="${MODEL:-$HOME/models/Qwen2.5-3B-Instruct-Q4_K_M.gguf}"
LLAMA_PORT="${LLAMA_PORT:-8080}"

SEARXNG_CONTAINER="${SEARXNG_CONTAINER:-searxng}"
SEARXNG_URL="${SEARXNG_URL:-http://localhost:8888}"

VENV_PY="${VENV_PY:-$HOME/sttvenv/bin/python}"
STT_MODEL="${STT_MODEL:-small}"
REC_SECONDS="${REC_SECONDS:-5}"

REPO_DIR="${REPO_DIR:-$HOME/Projects/pepper-studio}"
LOG_DIR="${LOG_DIR:-$HOME/pepper-logs}"
# ─────────────────────────────────────────────────────────────────────

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()  { printf '   \033[32m✓ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

wait_for() {  # url name timeout_s
  local url="$1" name="$2" timeout="${3:-60}" i=0
  until curl -sf -o /dev/null "$url"; do
    i=$((i + 1)); [ "$i" -ge "$timeout" ] && return 1
    sleep 1
  done
}

mkdir -p "$LOG_DIR"

# 1) robot bridge — must already be running ON the robot
say "Robot bridge  ($BRIDGE_URL)"
if curl -sf "$BRIDGE_URL/health" >/dev/null; then
  ok "up — $(curl -s "$BRIDGE_URL/health")"
else
  die "bridge is down. On the robot, run:
       ssh nao@$ROBOT_IP
       fuser -k 5001/tcp
       python bridge.py --ip 127.0.0.1 --port 9559 --bridge-port 5001"
fi

# 2) llama-server (the brain)
say "llama-server  (:$LLAMA_PORT)"
if curl -sf "http://localhost:$LLAMA_PORT/v1/models" >/dev/null; then
  ok "already running"
else
  [ -x "$LLAMA_BIN" ] || die "llama-server not found at $LLAMA_BIN  (set LLAMA_BIN=...)"
  [ -f "$MODEL" ]     || die "model not found at $MODEL  (set MODEL=...)"
  echo "   starting (logs: $LOG_DIR/llama.log) ..."
  nohup "$LLAMA_BIN" -m "$MODEL" -ngl 99 --ctx-size 4096 --jinja \
        --port "$LLAMA_PORT" --cache-ram 0 --parallel 1 \
        >"$LOG_DIR/llama.log" 2>&1 &
  echo "   waiting for the model to load ..."
  wait_for "http://localhost:$LLAMA_PORT/v1/models" llama 180 \
    || die "llama didn't come up — check $LOG_DIR/llama.log"
  ok "ready"
fi

# 3) SearXNG (web search) — optional; loop still runs without it
say "SearXNG  ($SEARXNG_URL)"
if docker start "$SEARXNG_CONTAINER" >/dev/null 2>&1 \
   && wait_for "$SEARXNG_URL/" searxng 30; then
  ok "ready"
else
  echo "   ⚠ not available — continuing with web search OFF"
  SEARXNG_URL=""
fi

# 4) the voice loop
export SIM_AI_BASE_URL="http://localhost:$LLAMA_PORT/v1"
export SIM_AI_MODEL="local"
export SIM_AI_API_KEY=""
export SIM_SEARXNG_URL="$SEARXNG_URL"
export PYTHONUNBUFFERED=1        # live output through the tee pipe

LOG="$LOG_DIR/chat-$(date +%Y%m%d-%H%M%S).log"
ln -sf "$LOG" "$LOG_DIR/latest.log"

say "Voice loop — transcript saved to $LOG  (also: $LOG_DIR/latest.log)"
echo "   Ctrl-C to stop. Press Enter each turn to talk."
cd "$REPO_DIR"
"$VENV_PY" -u simulator/voice_loop.py \
    --bridge "$BRIDGE_URL" --seconds "$REC_SECONDS" --model "$STT_MODEL" --loop \
    2>&1 | tee "$LOG"
