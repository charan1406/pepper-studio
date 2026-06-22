# Pepper Studio

A standalone, cross-platform sandbox for the **Pepper 1.8** robot. Drive it by
hand, test your own code against an HTTP bridge, and give it an optional in-app
AI brain — all in one app, no Python/Node install required.

- **Drive by hand** — UI controls move / pose / speak / animate the robot.
- **Test via code** — point your code at the same API-compatible HTTP bridge.
- **AI brain (optional)** — cloud key, a local server you run, or a GGUF the app
  launches for you. The **full** build can auto-download a llama.cpp engine + a
  model on first run. Works fully with no AI at all.

## Download

Grab the build for your OS from the [**Releases**](../../releases) page:

| Build | Use it if… |
|-------|------------|
| `pepper-studio` (lean) | you'll bring your own LLM (a running `llama-server` / Ollama / LM Studio, or a cloud API key) |
| `pepper-studio-full` | you want the app to download and run a local model for you on first launch (~2 GB, one time) |

Both builds include the simulator, manual control, web search, and in-app voice.

## Run

Unzip and launch the binary — it starts a local server and opens the app in your
browser at `http://localhost:5001`.

- **Linux:** `./pepper-studio/pepper-studio`
- **macOS:** `./pepper-studio/pepper-studio`
- **Windows:** double-click `pepper-studio\pepper-studio.exe`

### First launch on macOS / Windows (unsigned builds)

These releases are **not code-signed**, so the OS will warn the first time:

- **macOS:** right-click the binary → **Open** → **Open** (instead of double-click).
  Or: `xattr -dr com.apple.quarantine pepper-studio`.
- **Windows:** SmartScreen → **More info** → **Run anyway**.

This is expected for an unsigned app downloaded from the internet — it's a normal
local server, no installer, no admin rights.

## First run

A short welcome walks you through setting up the AI brain (or skip it — the robot
sandbox works without AI). After that:

- **Sim / Real** toggle (top bar) switches whether controls drive the simulator
  or a connected physical Pepper.
- **⌘K / Ctrl+K** opens the command palette for quick actions.
- **AI** button (left panel) configures the brain anytime.

Connecting a real Pepper is documented in
[`CONNECT_REAL_PEPPER.md`](CONNECT_REAL_PEPPER.md).

## Develop

```bash
cd simulator
python sim_bridge.py            # bridge + UI on http://localhost:5001
python -m pytest tests/ -q      # backend tests

cd web && npm install
npm run dev                     # Vite hot-reload UI (talks to the bridge)
npm run test                    # frontend tests
npm run build                   # rebuild the bundle the bridge serves
```

See [`CLAUDE.md`](CLAUDE.md) for architecture and project conventions.
