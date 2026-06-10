# VOICE_LOOP.md — Pepper's voice loop (hear → think → speak, with web search)

`simulator/voice_loop.py` is a **studio-side driver**: Pepper hears you, an LLM
answers (optionally after a web search), and Pepper speaks the reply. It talks
only to the bridge's HTTP contract (`/audio/record`, `/speak`), so the **same
command drives the sim or a real Pepper — only the `--bridge` URL changes**.

```
 mic ──POST /audio/record──▶ voice_loop.py ──┐
 (bridge)                                     │ faster-whisper  (STT, local)
                                              ▼
                                     [optional] web_search tool?
                                              │  yes → SearXNG JSON → inject snippets
                                              ▼
                                     llama-server  (LLM, OpenAI-compatible)
                                              │
 speaker ◀──POST /speak────── voice_loop.py ◀┘
 (bridge)
```

The robot bridge (NAOqi, Python 2.7) runs **neither** STT nor the LLM — both are
Python-3 and live wherever you run `voice_loop.py` (a laptop on the robot's LAN,
or your dev box against the sim). Keep STT/LLM on the same machine/LAN as the
bridge; only that path carries audio.

---

## What Pepper can do (tool-routed)

The brain decides per turn (`agent.py` + `chat_tools`, **needs `--jinja` on
llama-server**): casual chat is one fast call; real intents trigger a tool.

| Intent | Tool | Example |
|--------|------|---------|
| Chat | — (direct) | "who are you?" |
| Live facts | `web_search` → SearXNG | "weather in Berlin?", "who's the chancellor?" |
| Move | `move` / `turn` (clamped ≤0.5 m / ≤90°) | "come closer", "turn left" |
| Gesture | `wave` | "wave hello" |
| Music | `play_song` / `stop_audio` (yt-dlp) | "play some jazz", "stop the music" |
| Any language | STT auto-detect → reply + voice match | speak German → German reply |

---

## Prerequisites

| Piece | What | Where it runs |
|-------|------|---------------|
| **Bridge** | `simulator/sim_bridge.py` (sim) or `pepper/bridge.py` (real robot) | sim: your box · real: on Pepper |
| **STT** | `faster-whisper` in a venv | same box as `voice_loop.py` |
| **LLM** | `llama-server` (llama.cpp) + a **non-reasoning instruct** GGUF, run with `--jinja` | same box / LAN |
| **Search** *(optional)* | SearXNG container with JSON enabled | same box / LAN |
| **Music** *(optional)* | `yt-dlp` + `ffmpeg` on PATH | same box as `voice_loop.py` |

> **Model choice is the #1 latency lever — pick an _instruct_ model, never a
> _reasoning/thinking_ one.** Reasoning models (e.g. the `Qwen3.5` GGUFs) emit
> thousands of hidden reasoning tokens with no reliable off-switch — turning a
> 2-second turn into 15–55 seconds. There is no prompt or flag fix; just use an
> instruct model. Verified good: **`Qwen2.5-3B-Instruct-Q4_K_M`** (~2GB, fits a
> 4GB GPU, ~1.5–4s per turn).

---

## Setup

### 1. STT — faster-whisper venv

Arch/CachyOS block system `pip` (PEP 668), so use a venv. `faster-whisper`
installs cleanly even on Python 3.14 (ctranslate2 has cp314 wheels):

```bash
python -m venv ~/sttvenv
~/sttvenv/bin/pip install faster-whisper
```

The `small` model (~460MB) auto-downloads on first transcription and stays warm.

### 2. LLM — llama-server + an instruct model

Get a non-reasoning instruct GGUF:
```bash
curl -L -o ~/models/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf"
```

Run it — **`--jinja` is required for tool-calling (web search) to work**:
```bash
llama-server -m ~/models/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -ngl 99 --ctx-size 4096 --jinja --port 8080 \
  --cache-type-k q8_0 --cache-type-v q8_0
```
Sanity check:
```bash
curl -s http://localhost:8080/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"local","messages":[{"role":"user","content":"Say hi in one sentence."}]}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['choices'][0]['message']['content'])"
```
A quick clean sentence = good. If it pauses for many seconds, you're on a
reasoning model — swap it.

### 3. Search — SearXNG (optional)

JSON output is **off by default** in SearXNG; you must enable it.
```bash
docker pull searxng/searxng
mkdir -p ~/searxng-config && cat > ~/searxng-config/settings.yml <<'YAML'
use_default_settings: true
server: { secret_key: "pepper-studio-dev-key", limiter: false, image_proxy: false }
search: { formats: [html, json] }
YAML
docker run -d --name searxng -p 8888:8080 -v ~/searxng-config:/etc/searxng:rw searxng/searxng
```
Verify:
```bash
curl -s "http://localhost:8888/search?q=test&format=json" | head -c 80   # must be JSON, not HTML
```

### 4. Bridge

- **Sim:** `python simulator/sim_bridge.py` (serves on `:5001`).
- **Real Pepper:** deploy and run `pepper/bridge.py` on the robot — see
  [CONNECT_REAL_PEPPER.md](CONNECT_REAL_PEPPER.md). Confirm reachable:
  `curl http://<ROBOT_IP>:5001/health`.

---

## Run

```bash
export SIM_AI_BASE_URL=http://localhost:8080/v1   # llama-server
export SIM_AI_MODEL=local
export SIM_SEARXNG_URL=http://localhost:8888      # omit to disable web search

~/sttvenv/bin/python simulator/voice_loop.py --bridge http://<ROBOT_IP>:5001 --loop
```

The startup banner should read:
```
bridge : http://<ROBOT_IP>:5001
brain  : on — http://localhost:8080/v1
stt    : faster-whisper small
search : on — http://localhost:8888
```
Per turn: press **Enter** → speak during the listen window → `[heard]` shows the
transcript → `[reply]` and Pepper speaks. Eyes go blue (listening) → cyan
(thinking) → green (speaking). A search turn prints `[search] query: …`.

### Options & environment

| Flag | Default | Meaning |
|------|---------|---------|
| `--bridge URL` | `http://localhost:5001` | sim or real Pepper |
| `--seconds N` | `5` | record window per turn |
| `--model SIZE` | `small` | whisper size (`tiny`/`base`/`small`/`medium`) |
| `--loop` | off | keep going turn after turn |

| Env var | Meaning |
|---------|---------|
| `SIM_AI_BASE_URL` | LLM endpoint (blank = no brain) |
| `SIM_AI_API_KEY` | only for cloud LLMs |
| `SIM_AI_MODEL` | model name (`local` for llama-server) |
| `SIM_AI_TIMEOUT` | LLM request timeout, seconds (default 120) |
| `SIM_SEARXNG_URL` | SearXNG base URL (blank = search off) |
| `SIM_STT_LANGUAGE` | force STT language e.g. `de` (blank = auto-detect per utterance) |

---

## Troubleshooting

| Symptom | Cause → fix |
|---------|-------------|
| Turns take 15–55s; `reasoning_content` is huge | **Reasoning model.** No prompt/flag disables it — switch to an instruct model (Qwen2.5-3B-Instruct). |
| Search never triggers; model answers from memory | `llama-server` missing **`--jinja`** (tool-calling needs it). |
| `[loop] heard nothing` every turn | Mic silent or STT off. On the **sim**, `/audio/record` needs `pyaudio` + a real mic, else it returns silence. On the **real robot** the mic works (returns 48kHz mono — whisper resamples, fine). |
| `couldn't bind HTTP server socket … port 8080` | Port in use — pick another (`--port 8090`) and update `SIM_AI_BASE_URL`. |
| SearXNG returns HTML, not JSON | `format: json` not enabled — add `search.formats: [html, json]` to settings.yml and restart the container. |
| `pip install` refused (externally-managed) | Arch PEP 668 — install into the venv (`~/sttvenv/bin/pip`), not system. |
| CUDA build of llama.cpp killed (`signal 9`, `cc1plus killed`) | OOM from `-j` all-cores on the heavy CUDA template files — rebuild with `-j 2` (or `-j 1`). |
| Vulkan build runs on the wrong GPU (iGPU not dGPU) | Force the NVIDIA index: `GGML_VK_VISIBLE_DEVICES=0 ./llama-server …` (check the `ggml_vulkan:` device list for the index). |
| A single bad turn used to kill the loop | Fixed — timeouts/bridge blips now log `[loop] turn failed … continuing`. |
| Weather answers sometimes "couldn't find it" | Live weather snippets are messy; ~⅔ hit rate. It declines honestly rather than inventing a number. Factual lookups (names, scores, dates) are reliable. |

---

## What's verified vs not

- **Verified end-to-end on a real Pepper (2026-06-10):** mic capture → STT →
  LLM → speech, clean turns.
- **Verified on the dev box:** SearXNG routing + synthesis (factual lookups
  reliable, weather ~⅔), and the instruct-model latency (1.5–4s vs 55s).
- **Not yet:** search/tool-calling exercised against the *real* robot mic in one
  sitting (built and proven headless; just needs a robot window to run live).
