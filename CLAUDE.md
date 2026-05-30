# CLAUDE.md — Pepper Studio Project Context

## Karpathy Principles — Read This First
These are the operating rules for every Claude Code session on this project. They are self-contained so any session or subagent that only loads this file has the full working contract.

### Thinking Framework (How You Think)
- **Empirical over theoretical.** Don't argue whether a control change should work — run the bridge, hit the endpoint, watch the 3D model and the API log. "I think this will improve X" is worthless without a number or an observed behavior.
- **Verifiability thesis.** Focus effort where results can be measured with a scalar metric or an observable outcome — endpoint reachable from the UI, single-process launch succeeds, `grep` for cross-project imports returns nothing, build artifact launches on a clean machine. If you can't eval it, you can't improve it.
- **Simplify ruthlessly / single-dial complexity.** If a component can't justify its existence in one sentence, it shouldn't exist. Three clean lines beat a clever abstraction; one config dial beats five. AI is one dial (`base_url` + `api_key` + `model`), not a per-provider matrix.
- **No cargo-culting.** "It's the default" or "the docs suggest it" is not a reason. Every dependency, port, and packaging choice needs a reason tied to *this* app on *these* target machines (Win/Mac/Linux, possibly no Python/Node installed).
- **Agentic engineering, not vibe coding.** Inspect diffs. Verify outputs. Design specs before writing code. You can outsource your thinking, but you can't outsource your understanding.
- **One variable at a time.** When debugging the bridge, physics, or the WebGL frontend, change one thing, measure, keep or discard. No combinatorial explosions.
- **March of nines.** The demo working 90% of the time is the first nine and the easy part. Each additional nine is a constant amount of additional work. Call out when something works in the sim but will break with a real bridge URL, a flaky network, a clean machine with no GPU, or the weakest system webview.
- **Read the data.** Before any decision — look at the actual endpoint payloads, the WS frames, the joint limits in `sim_state.py`. What does the real distribution look like? What is actually breaking vs what you assume is breaking?
- **Micrograd mindset.** Understand every layer — `http.server`, the WebSocket channel, the Three.js scene graph, NAOqi's `ALProxy`, the Jinja-free OpenAI-compatible client. Don't treat any framework as a black box. If something breaks, you should know why without googling.

### One-Shot Engineering
When given a task, get it right the first time:
- **Fully scope before touching code.** Read every file involved. grep for every symbol you'll use. Map the dependencies. If unsure about anything, ask before you start — not after 200 lines.
- **State your plan in 3 lines before implementing.** What you're changing, what success looks like, what could break. Then execute.
- **Anticipate the edges.** Don't just handle the happy path. Think about empty input, missing files, network timeouts, a down bridge, a wrong bridge URL, no camera/mic, no GPU, concurrent control inputs, the real robot mid-motion. Whichever apply.
- **Test in the same message.** Write the code, then immediately run it or write the test. Never say "this should work" — show that it works. When it genuinely can't be run here (real Pepper, a specific OS build), state exactly what you couldn't verify and why.
- **If you're uncertain, say so before acting.** A question costs one message. A wrong implementation costs five.

### Working Rules
1. **Read before write.** Read the relevant section before changing any file. Use grep to find the right location. Never load 500 lines when you need 20.
2. **Verify, don't assume.** If you think a route is named `/move/velocity`, grep the bridge for it. False confidence causes cascading bugs.
3. **Success criteria before implementation.** Before writing any code, state:
```
Goal: [what we're changing]
Success: [observable outcome — endpoint reachable, UI reflects it, test passes, build launches]
Verify: [exact command or test to confirm]
Rollback: [how to undo]
```
4. **Plan → implement → verify loop.** Never chain multiple unverified changes. Each step must pass before the next starts.
5. **Don't over-engineer.** A 5-line fix beats a 50-line abstraction. Match complexity to the problem.

### Behavior
- Be direct. No fluff, no filler, no "Great question!" openings.
- When given a problem, diagnose the root cause before suggesting fixes.
- If an approach is wrong, say so and explain why. Don't just comply.
- When writing code: no unnecessary comments, no boilerplate, no over-engineering. Write what's needed and nothing more.
- If you need more context to give a good answer, ask — don't guess.
- When debugging, trace the actual execution path. Don't just pattern-match on the error message.
- Flag your own mistakes. If you realize mid-response that an earlier assumption was wrong, correct it immediately — don't silently continue.

### Accountability
Every piece of code and every architectural decision will be reviewed by a separate AI agent for correctness, security, edge cases, and adherence to project constraints. Write code that survives that review on the first pass. If you wouldn't be confident defending a choice under scrutiny, reconsider it before committing.

### Knowledge Bridging
The owner is self-taught and building by doing, and doesn't always know the proper terms or what tools/techniques exist. When a problem is described in plain language:
- **Name the concept.** If it has a standard term (ASGI, WebGL context loss, teleoperation, sidecar process, code-signing), say so.
- **Show what exists.** List the options available — not just the one you'd pick.
- **Compare for the constraints.** Rank options for the dev machine (RTX 3050 4GB, Arch Linux) and for the end-user target (cross-platform, possibly no Python/Node/GPU). Kill anything that won't fit before time is wasted on it.
- **Explain the why, not just the what.**
- **Flag things probably missing.** If there's a well-known technique or tool that would significantly improve this and it hasn't come up, bring it up.

### Code Standards
- Prefer simple, readable code over clever abstractions.
- Type hints in Python where they add clarity.
- Handle errors at boundaries, not everywhere.
- If a stdlib solution exists, use it before reaching for a dependency — this app must stay lean to package cleanly.
- Optimize for the constraints: lean dependency tree (PyInstaller-friendly), cross-platform, optional hardware.

---

## Project Overview
**Pepper Studio** is a standalone, decoupled, cross-platform **sandbox app for the Pepper 1.8 robot**. It is a *playground*, not a viewer, built on three pillars:

1. **Drive the robot by hand** — UI controls that move / pose / speak / animate the robot.
2. **Test via code** — point your own code at the API-compatible HTTP bridge.
3. **Optional AI** — wire in an LLM by localhost URL *or* API key (bring-your-own); fully usable with no AI at all.

This repo is the **BRIDGE + STUDIO UI**. It does **not** contain an LLM brain. The companion project `pepper-ai` (the 4B "brain") is a *consumer* of this bridge over the HTTP contract — not a dependency of this repo.

### What this repo IS
- The robot simulator (`sim_bridge.py` + `sim_state.py`) and its 3D web UI.
- The real-robot bridge (`pepper/bridge.py`, NAOqi 2.5 / Python 2.7) — same HTTP contract as the sim.
- A bring-your-own, OpenAI-compatible AI seam (optional).

### What this repo is NOT
- Not the LLM brain (lives in `pepper-ai`).
- Not a bundled model — no GPU-heavy weights ship here (contradicts non-dev packaging).
- Not an Electron app — rejected for resource bloat and being wrong for a GPU-heavy WebGL frontend. Packaging target is a **"localhost app"**: a PyInstaller backend that auto-opens the user's existing browser (the Jupyter / TensorBoard / Gradio / ComfyUI pattern). Optional pywebview native-window build later.

## Architecture — 3 layers, one seam
- **BRIDGE CONTRACT** — the HTTP API. Two implementations behind the *same* route table:
  - `simulator/sim_bridge.py` (fake, Python 3) — HTTP on `:5001`, WebSocket state broadcast on `:5003` @ 20fps, backed by the `sim_state.py` physics engine.
  - `pepper/bridge.py` (real, NAOqi `ALProxy`, Python 2.7) — pure robot I/O, identical routes.
- **STUDIO UI** — React + Three.js + zustand (Vite). 3D viz + manual control + monitoring + API testing. Talks HTTP to a **bridge URL that is a user setting** (default `localhost:5001`). That setting is the deliberate hook for connecting to a real Pepper later — same controls become teleop.
- **AI (optional)** — one OpenAI-compatible client (`simulator/llm.py`, vendored, stdlib-only) driven by `base_url` + `api_key` + `model`. Covers localhost (llama-server / Ollama / LM Studio) and cloud (OpenAI / Anthropic-compat / OpenRouter / Groq). `"None"` = pure robot sim, mock fallback.

**Key consequence:** "bridge to a real Pepper" is not a build artifact — it's a workflow: point the Studio at the real bridge's URL. Deploying `pepper/bridge.py` to the robot is documented in `DEPLOYMENT.md`.

## Project Structure
```
pepper-studio/
├── CLAUDE.md                    # This file
├── DEPLOYMENT.md                # Deploy the real Py2.7 bridge to a physical Pepper
├── .gitignore                   # Ignores docs/ (specs/plans kept local), node_modules, venv
├── docs/                        # Local working docs — specs/plans (gitignored, NOT published)
├── pepper/
│   ├── bridge.py                # Real NAOqi bridge (Python 2.7) — same routes as sim
│   └── client.py                # HTTP client for the bridge (all endpoints)
└── simulator/
    ├── sim_bridge.py            # Mock bridge :5001 + serves web/dist + WS :5003. Standalone, zero pepper-ai imports.
    ├── sim_state.py             # Physics engine — 17 joints (NAOqi limits), 60fps interp, battery, postures, occupancy grid
    ├── llm.py                   # Vendored OpenAI-compatible client (optional AI), stdlib-only, mock fallback
    ├── requirements.txt
    ├── start_bridge.sh          # Launch bridge
    ├── start_web.sh             # Launch Vite dev server (frontend dev only)
    ├── tests/                   # pytest: test_decouple / test_llm / test_smoke / test_static
    └── web/                     # React + Three.js + zustand (Vite)
        ├── dist/                # Prebuilt UI served by the bridge in one process
        └── src/                 # App.jsx, components/, hooks/usePepperState.js
```

## Bridge API Contract (the seam — keep sim and real in lockstep)
Manual control POSTs to **existing** endpoints. Both bridge implementations must expose the same routes:
- Movement: `/move/velocity`, `/move/to`, `/move/stop`, `/navigate/goto`
- Posture: `/posture/set`
- Speech: `/speak`, `/speak/stop`
- LEDs: `/leds/eyes`, `/leds/ears`
- Animation: `/animation/list`, `/animation/run`
- Head/joints: `/head/set`, `/joints/set`
- State: WebSocket on `:5003` (sim) for live telemetry; `/chat`, `/search_results` are sim-only demo extras.

When changing the contract, change **both** `sim_bridge.py` and `pepper/bridge.py`, or the sim stops predicting the real robot.

## Build Order & Status (SP1 — Standalone Sandbox)
1. ✅ **Decouple + single process** *(keystone, DONE & verified)* — `python simulator/sim_bridge.py` runs standalone with zero `pepper-ai` imports, serves `web/dist` on `:5001`, AI optional via `SIM_AI_BASE_URL` / `SIM_AI_API_KEY` / `SIM_AI_MODEL`. 10 pytest tests green. Auto-opens the browser.
2. ⬅️ **Manual control panel** *(NEXT)* — wire the frontend to the existing bridge endpoints above; add a small HTTP client module (today only `ChatPopup` calls out); make the **bridge URL a setting from day 1**.
3. **AI settings + code-testing affordances** — settings UI for the AI dial; in-app API reference + copy-paste curl/Python snippets; keep the live API log.
4. **Package** — PyInstaller "localhost app" per OS; optional pywebview native build. `opencv` / `pyaudio` stay optional ("enable hardware" extra) so the base build is lean and cross-platform-clean.

**Deferred sub-projects (own specs later):** SP2 — real-robot bridge mode (teleop, live joint mirroring, **safety: e-stop, motion limits, connection-loss handling**). SP3 — sim→real one-command deploy/export.

## Environment & Run
```bash
cd ~/Projects/pepper-studio

# One-process app: bridge + UI on http://localhost:5001 (auto-opens browser)
python simulator/sim_bridge.py

# Frontend dev (hot reload) — only when changing the UI
cd simulator && ./start_web.sh    # Vite dev server, talks to bridge :5001 / WS :5003

# Tests
cd simulator && python -m pytest tests/ -q

# Rebuild the UI bundle the bridge serves
cd simulator/web && npm run build   # outputs web/dist/
```
Optional AI (bring-your-own, OpenAI-compatible):
```bash
export SIM_AI_BASE_URL="http://localhost:8090/v1"   # llama-server / Ollama / LM Studio / cloud
export SIM_AI_API_KEY="..."                         # blank for local
export SIM_AI_MODEL="local"
```

## Conventions
- **Python 3.11+** for the simulator/bridge middleware; **Python 2.7 ONLY** for `pepper/bridge.py` (NAOqi 2.5 constraint).
- Keep `sim_bridge.py` **free of `pepper-ai` imports** — that decoupling is the whole point. Verify with `grep -rn "brains\.\|from core\|import core" simulator/` → must be empty.
- AI is **optional and bring-your-own**. Never bundle a model or hardcode a provider. One dial: `base_url` + `api_key` + `model`.
- Frontend talks to the **bridge URL setting**, never a hardcoded host. Derive WS host from `window.location` for non-localhost.
- Keep the dependency tree lean and PyInstaller-friendly. `opencv` / `pyaudio` are optional with graceful fallback (browser TTS is the default speech path).
- `docs/` is gitignored — specs and plans live there locally and are not published.
- Atomic file writes for any persisted state (`.tmp` → rename).

## Relationship to pepper-ai
`pepper-ai` (the LLM brain) and Pepper Studio are **separate repos** connected only by the HTTP bridge contract. The brain is a *consumer*: it drives a Pepper (sim or real) by calling the same endpoints the Studio UI calls. Changes to the bridge contract affect both — coordinate them.

## Why this exists (scope discipline)
Pepper is a **social / HRI robot** — conversation, greeting, memory of people, gaze, gesture, light navigation. It commercially flopped because its scripted dialogue was the weak link, not its hardware. The API-identical bridge + real physics + 3D viz is ~80% of a standalone product already; the friction to "app" was runtime (3 processes + venv/npm), which SP1 collapses. **Scope to Pepper's real strengths: conversation / memory / gaze / gesture / light-nav. NOT manipulation or rough mobility — the hardware can't.**
