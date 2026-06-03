# Connecting Pepper Studio to a Real Pepper 1.8

End-to-end guide for driving a physical Pepper from Pepper Studio, over WiFi.
Written for a setup where **Studio runs on a Linux (Arch) machine** and **Pepper
is on the same network**.

> This is the **real-robot teleop workflow**, which the app was built around:
> Studio talks to a *bridge URL setting* (default `localhost:5001`); point that
> setting at the robot and the same controls drive the real Pepper.

---

## ⚠️ Read this before you start — what works today, what doesn't

This is honest scope. Connecting for **manual control works now**. Live mirroring
and a safety layer are **not built yet** (tracked as SP2). Don't expect them.

| Capability | Status | Notes |
|---|---|---|
| Speak (robot's own voice) | ✅ Works | `/speak` → Pepper's onboard Acapela TTS. No voice packs needed on the PC. |
| Postures, head, joints | ✅ Works | `/posture/set`, `/head/set`, `/joints/set` |
| Drive (velocity / goto) | ✅ Works | `/move/velocity`, `/move/to`, `/navigate/goto` — **see safety section** |
| LEDs, animations | ✅ Works | `/leds/eyes`, `/leds/ears`, `/animation/run` |
| **Live 3D mirror of the real robot** | ❌ **Not yet** | The 3D model shows the *simulator's* idle pose, **not** the real robot. See [Known limitations](#known-limitations). |
| **Battery / state read-back in the UI** | ❌ **Not yet** | UI panels read the sim, not the robot. (The robot *does* answer `/health` and `/battery` over curl.) |
| **E-stop / motion limits / reconnect safety** | ❌ **Not built** | Only `/move/stop` exists. **A dropped connection mid-move does not stop the robot.** See [Safety](#-safety-must-read). |

If you only want to test the API contract or develop, you don't need the robot at
all — just run Studio (Part B) and leave the bridge URL on `localhost:5001`.

---

## Architecture

```
┌───────────────────────────┐        WiFi / LAN        ┌────────────────────────────┐
│  Pepper 1.8 (the robot)    │◄──── HTTP :5001 ────────►│  Arch machine (Studio host)│
│                            │                          │                            │
│  Python 2.7 + NAOqi 2.5    │   speak / move / pose /  │  Python 3.11+              │
│  bridge.py  (you deploy)   │   LEDs / animation       │  sim_bridge.py  (Studio)   │
│    └ ALProxy → 127.0.0.1   │                          │    ├ serves the UI :5001   │
│       :9559 (local NAOqi)  │                          │    └ browser opens the UI  │
│  HTTP bound on 0.0.0.0:5001│                          │  UI "bridge URL" → robot   │
└───────────────────────────┘                          └────────────────────────────┘
```

**Two programs, two machines:**
- **On Pepper:** `pepper/bridge.py` — a thin HTTP server that turns the bridge
  contract into NAOqi calls. It connects to NAOqi locally (`127.0.0.1:9559`).
- **On Arch:** `simulator/sim_bridge.py` — serves the Studio web UI and auto-opens
  your browser. You then set the UI's **bridge URL** to the robot.

**Why run `bridge.py` on Pepper and not on the PC?** It imports `from naoqi import
ALProxy`. Pepper already has Python 2.7 + the NAOqi SDK installed. Installing the
old NAOqi 2.5 Python-2.7 SDK on a modern Arch box (Python 2.7 EOL, legacy libs) is
a rabbit hole — running on the robot avoids it entirely. (Running the bridge
remotely *is* possible if a machine has the SDK, but that's the harder path.)

---

## Prerequisites

**Robot side (Pepper):**
- Pepper 1.8 powered on, booted, on the same WiFi/LAN as the Arch machine.
- SSH access (default user `nao`, default password `nao`).
- Python 2.7 + NAOqi SDK — **already on the robot**, nothing to install.

**Arch side:**
- Python 3.11+
- `git` (to get the repo)
- A browser
- **No Node/npm needed** — the UI ships prebuilt in `simulator/web/dist/`.
- **No voice packs needed** — the robot speaks with its own voice.

---

## Part A — Set up the bridge on Pepper

### A1. Find Pepper's IP

Press Pepper's chest button **once** — it speaks its IP address out loud.
(Or check your router's DHCP client list.) Call it `<PEPPER_IP>` below.

### A2. Copy the bridge to the robot

From the repo on your Arch machine:

```bash
scp pepper/bridge.py nao@<PEPPER_IP>:~/bridge.py
# password: nao  (unless changed)
```

`bridge.py` uses only the Python 2.7 standard library plus NAOqi, so there is
**nothing to `pip install` on the robot**. (`cv2`/`numpy` are optional and only
affect camera JPEG encoding, which the Studio UI doesn't use.)

### A3. Start the bridge on the robot

```bash
ssh nao@<PEPPER_IP>
python bridge.py --ip 127.0.0.1 --port 9559 --bridge-port 5001
```

`--ip 127.0.0.1` because the bridge runs **on** the robot and talks to the local
NAOqi. You should see:

```
============================================================
  PEPPER BRIDGE — REAL NAOqi CONNECTION
  Robot: 127.0.0.1:9559
  Bridge: http://localhost:5001
============================================================
[OK] Connected to Pepper. Battery: 85%
[BRIDGE] Listening on port 5001
```

If it prints `[ERROR] Cannot connect to Pepper` or `[FATAL] NAOqi SDK not
available`, see [Troubleshooting](#troubleshooting).

The bridge binds `0.0.0.0:5001`, so it's reachable from the Arch machine on the
LAN, and it sends permissive CORS headers, so the browser-based UI can call it
cross-origin.

> Tip: to keep it running after you close SSH, use `tmux`/`screen`, or
> `nohup python bridge.py --ip 127.0.0.1 --bridge-port 5001 &`.

---

## Part B — Run Studio on the Arch machine

```bash
git clone https://github.com/charan1406/pepper-studio.git   # or your fork
cd pepper-studio

python -m venv .venv
source .venv/bin/activate
pip install -r simulator/requirements.txt        # just `websockets`

python simulator/sim_bridge.py
```

It serves the UI and auto-opens your browser at **http://localhost:5001**:

```
  PEPPER SIMULATOR BRIDGE
[BRIDGE] Listening on http://localhost:5001
[UI] Open http://localhost:5001
```

> The Studio process also runs the simulator physics in the background — that's
> fine and expected. It's what serves the UI and (for now) drives the 3D view.
> To suppress the auto-open browser: `SIM_OPEN_BROWSER=0 python simulator/sim_bridge.py`.

---

## Part C — Point Studio at the real robot

By default the UI's **bridge URL is `http://localhost:5001`** — i.e. the Arch
machine's own simulator. To drive the real Pepper you must change it.

1. In the Studio UI, find the **Bridge URL** field (in the control panel; its
   placeholder is `http://localhost:5001`).
2. Set it to:
   ```
   http://<PEPPER_IP>:5001
   ```
   The setting persists in the browser (localStorage).

That's it — every control button now POSTs to the real robot.

### Verify the link (do this before touching motion)

From the Arch machine:

```bash
# 1. Robot reachable? Expect "simulator": false and a real battery %
curl http://<PEPPER_IP>:5001/health

# 2. Make it talk (safe, no motion)
curl -X POST http://<PEPPER_IP>:5001/speak \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello, I am connected to Studio."}'
```

If Pepper speaks, the link is good. Watch the bridge's terminal on the robot — it
will be handling these requests.

---

## ⚠️ Safety (must read)

There is **no e-stop, no motion clamping, and no connection-loss handling** in the
bridge yet (this is the deferred SP2 work). Specifically:

- **`/move/velocity` is a *continuous* command.** It calls NAOqi `moveToward`,
  which keeps the robot moving until it receives `/move/stop` or a new command.
  **If the WiFi drops while Pepper is moving, it does not stop on its own.**
- There is no upper bound on the velocity/angle you can send.

**Before any movement test:**
1. Have a human within reach of Pepper's **chest button** (hardware pause/stop).
2. Give it open floor space — no stairs, ledges, cables, or people in the path.
3. Test with **small** velocities first (e.g. `x: 0.15`), for **short** bursts,
   and always have the stop command ready:
   ```bash
   # E-STOP (keep this in a second terminal, ready to run)
   curl -X POST http://<PEPPER_IP>:5001/move/stop
   ```
4. Confirm the WiFi is solid. A flaky link + a velocity command = a runaway robot.

For first contact, prefer non-driving tests: speak, LEDs, head, posture changes.

---

## First safe movements (recommended order)

```bash
R=http://<PEPPER_IP>:5001

# Disable Autonomous Life so Pepper doesn't fight your commands (see note below)
curl -X POST $R/autonomous/set -H 'Content-Type: application/json' -d '{"enabled":false}'

# Stand up / wake motors (also stiffens the body so later joint commands take effect)
curl -X POST $R/posture/set -H 'Content-Type: application/json' -d '{"posture":"StandInit","speed":0.5}'

# Eyes blue
curl -X POST $R/leds/eyes -H 'Content-Type: application/json' -d '{"r":0,"g":0,"b":255}'

# Look around
curl -X POST $R/head/set -H 'Content-Type: application/json' -d '{"yaw":0.5,"pitch":0.0,"speed":0.2}'

# ONLY in open space, with stop ready: nudge forward, then STOP
curl -X POST $R/move/velocity -H 'Content-Type: application/json' -d '{"x":0.15,"y":0,"theta":0}'
sleep 1
curl -X POST $R/move/stop
```

After this works from curl, the same actions work from the Studio UI buttons.

**Two gotchas worth knowing:**
- **Autonomous Life:** if enabled, Pepper moves and looks around on its own and
  will resist your posture/joint commands. Disable it (above) for clean teleop.
- **Stiffness:** `/joints/set` does *not* set stiffness. If the robot is relaxed
  (stiffness 0), joint commands won't visibly move it. Send a posture first
  (`StandInit`) to wake and stiffen the body.

---

## Known limitations

- **The 3D model does not reflect the real robot.** The UI's live state comes from
  a WebSocket on `:5003`, whose host is hardwired to the page's own host
  (`ws://localhost:5003` here) — i.e. the Arch simulator — and the real bridge has
  no WebSocket at all. So you'll *send* commands to Pepper while the 3D view shows
  the simulator's idle pose. Use the robot itself (and the bridge's terminal) as
  ground truth.
- **UI panels (battery, position, joints) show the simulator,** not the robot, for
  the same reason. The robot answers `/health`, `/battery`, `/joints/angles`,
  `/posture/current` over HTTP — but the current UI doesn't poll them for the
  real-robot case.
- **Which controls are wired in the UI:** move/stop, posture, speak/stop, eye
  LEDs, animations (list/run), head, and navigate-goto. Other bridge endpoints
  (camera, audio record/play, tablet, face-tracking, ear LEDs, awareness) exist on
  the robot bridge but are reachable via curl/your own code, not all via buttons.

---

## Troubleshooting

**`[FATAL] NAOqi SDK not available` on the robot**
You're not running on Pepper, or under the wrong Python. The NAOqi SDK is Python
2.7. Run `bridge.py` on the robot with its system `python` (2.7).

**`[ERROR] Cannot connect to Pepper` on startup**
NAOqi isn't reachable at `127.0.0.1:9559`. Make sure you're running on the robot
and NAOqi is up. Restart NAOqi if needed:
`ssh nao@<PEPPER_IP> "sudo /etc/init.d/naoqi restart"`.

**`curl http://<PEPPER_IP>:5001/health` times out from the PC**
- Same WiFi/LAN? `ping <PEPPER_IP>` first.
- Is the bridge actually running on the robot (Part A3 still open)?
- Some networks isolate WiFi clients ("AP isolation") — put both on the same
  subnet / disable client isolation.

**Browser fetch fails / CORS error**
The bridge sends `Access-Control-Allow-Origin: *` and handles `OPTIONS`, so this
shouldn't happen over HTTP. If you serve the UI over HTTPS, the browser will block
calls to the plain-HTTP robot (mixed content) — serve the UI over HTTP.

**UI buttons do nothing / drive the wrong thing**
You probably didn't change the bridge URL (Part C). Default is `localhost:5001` =
the Arch simulator, not the robot. Re-check the Bridge URL field.

**Robot won't move / won't hold a pose**
Autonomous Life is fighting you, or the body is relaxed. Disable Autonomous Life
and send `StandInit` first (see [First safe movements](#first-safe-movements-recommended-order)).

---

## Optional — give Pepper an AI brain

Studio can run an LLM in-app so Pepper converses instead of being puppeted. It's a
single OpenAI-compatible dial (`base_url` + `api_key` + `model`), configured at
runtime via the AI panel (or `/ai/config`), fed by one of: a cloud key, a running
local server, or a `llama-server` sidecar Studio launches from a GGUF. The brain
drives the robot by calling the **same bridge endpoints** — so it works against the
real Pepper exactly like the manual controls. No weights or inference binary ship
with Studio; see **`LLAMA_SETUP.md`** to set up `llama-server` + a GGUF.

---

## Shutting down

- **Studio (Arch):** `Ctrl-C` in its terminal.
- **Bridge (robot):** `Ctrl-C` in the SSH session (`[SHUTDOWN] Bridge stopping.`).
- Leaving the bridge running is harmless, but stop it before powering Pepper down.

---

## Quick reference — endpoints used here

| Action | Method | Path | Body |
|---|---|---|---|
| Health / battery | GET | `/health` | — |
| Speak | POST | `/speak` | `{"text": "...", "language": "en"}` |
| Stop speaking | POST | `/speak/stop` | `{}` |
| Posture | POST | `/posture/set` | `{"posture": "StandInit", "speed": 0.5}` |
| Head | POST | `/head/set` | `{"yaw": 0, "pitch": 0, "speed": 0.2}` |
| Drive (velocity) | POST | `/move/velocity` | `{"x": 0.15, "y": 0, "theta": 0}` |
| **Stop driving (e-stop)** | POST | `/move/stop` | `{}` |
| Go to pose | POST | `/navigate/goto` | `{"x": 1, "y": 0, "theta": 0}` |
| Eye LEDs | POST | `/leds/eyes` | `{"r": 0, "g": 0, "b": 255}` |
| Animations | GET / POST | `/animation/list`, `/animation/run` | `{"name": "..."}` |
| Autonomous Life | POST | `/autonomous/set` | `{"enabled": false}` |
