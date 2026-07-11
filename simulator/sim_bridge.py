"""
Pepper Simulator — Bridge Server
==================================
HTTP server with IDENTICAL endpoints to the real Pepper bridge.
Swap config.BRIDGE_URL and the middleware works unchanged.

Runs on port 5001. Also runs a WebSocket server on port 5003
to broadcast state updates to the 3D web frontend.
"""

import json
import time
import datetime
import importlib.util
import socket
import urllib.request
import base64
import struct
import threading
import asyncio
import hashlib
import wave
import io
import os
import mimetypes
import atexit
import signal
import sys

from llm import SimLLMClient
import ai_config
import runner
import provision
import connection
import voice_service
import services

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# WebSocket support
try:
    import websockets
    import websockets.sync.server
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False
    print("[WARN] websockets not installed. 3D UI won't receive live state.")

# Webcam support
try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False
    print("[WARN] opencv-python not installed. Camera simulation disabled.")

# Audio support
try:
    import pyaudio
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False
    print("[WARN] pyaudio not installed. Mic simulation disabled.")

import subprocess
import shutil

from sim_state import PepperState


# ─── Global State ──────────────────────────────────────────────────
pepper = PepperState()
ws_clients = set()
webcam = None
audio_manager = None
audio_stream = None
pa = None

SIM_WEB_PORT = int(os.environ.get("SIM_WEB_PORT", 5002))
SIM_WS_PORT = int(os.environ.get("SIM_WS_PORT", 5003))
SIM_BRIDGE_PORT = int(os.environ.get("SIM_BRIDGE_PORT", 5001))
# Frozen (PyInstaller) puts bundled data under sys._MEIPASS; source run uses
# this file's directory. web/dist is added to the bundle via the .spec datas.
_BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(_BASE_DIR, "web", "dist")

# ─── LLM Brain (optional, bring-your-own) ─────────────────────────
# Any OpenAI-compatible endpoint: local (llama-server/Ollama/LM Studio) or
# cloud (set SIM_AI_API_KEY too). Config persisted in ~/.pepper-studio/ai.json;
# runtime-settable via POST /ai/config. Empty base_url => AI off, /chat mocks.
_ai_lock = threading.RLock()  # reentrant: _post_ai_config holds it and calls _rebuild_brain
_ai_cfg = ai_config.load()


def _build_brain(cfg):
    return SimLLMClient(
        base_url=cfg.get("base_url", ""),
        api_key=cfg.get("api_key", ""),
        model=cfg.get("model", "local"),
        timeout=cfg.get("timeout", 60),
    )


brain = _build_brain(_ai_cfg)
chat_history: list = []
if brain.enabled:
    print(f"[LLM] AI enabled: {brain.base_url} (model={brain.model})")
else:
    print("[LLM] AI disabled — /chat returns mocks. Set it via the AI panel or SIM_AI_BASE_URL.")

_runner_cfg = runner.load()


def _rebuild_brain():
    """Point brain at the runner sidecar while it's ready, else the persisted dial."""
    global brain
    with _ai_lock:
        rb, rm = runner.active()
        if rb:
            cfg = {"base_url": rb, "model": rm, "api_key": "", "timeout": _ai_cfg.get("timeout", 60)}
        else:
            cfg = _ai_cfg
        brain = _build_brain(cfg)


runner.set_callbacks(on_ready=lambda url, model: _rebuild_brain(),
                     on_exit=_rebuild_brain)

# ─── Bundle marker + first-run LLM provisioning ("full" build only) ──────────
# bundle.json is written into the bundle by the .spec; absent in a source run.
def _read_bundle():
    try:
        with open(os.path.join(_BASE_DIR, "bundle.json")) as f:
            return str(json.load(f).get("bundle", "lean")).lower()
    except (OSError, ValueError):
        return "lean"


BUNDLE = _read_bundle()
_provision_thread = None


def _provision_handoff():
    """On a finished download, point the runner at the fetched binary + GGUF."""
    st = provision.status()
    if st["state"] != "done":
        return
    _runner_cfg["binary"] = st["binary"]
    _runner_cfg["models_dir"] = provision.MODELS_DIR
    _runner_cfg["gguf"] = st["gguf"]
    flags = dict(_runner_cfg.get("flags") or {})
    if st.get("mmproj"):
        flags["mmproj"] = st["mmproj"]   # VL vision tower -> llama-server --mmproj
    _runner_cfg["flags"] = flags
    runner.save(_runner_cfg)
    runner.start(st["gguf"], flags, binary=st["binary"])


def _start_provision(backend=None, model=None):
    global _provision_thread
    if _provision_thread and _provision_thread.is_alive():
        return provision.status()

    def _run():
        provision.provision(backend=backend, model=model)
        _provision_handoff()

    _provision_thread = threading.Thread(target=_run, daemon=True)
    _provision_thread.start()
    return provision.status()

# ─── Local TTS (Piper sidecar) ───────────────────────────────────
# Browser TTS is the default audio path. When piper-tts + flask + aplay + a model
# are present, we run `python -m piper.http_server` as a SIDECAR (separate
# process). Piper/onnxruntime/espeak hold the GIL for seconds during load+synth,
# so running them in-process would freeze the single-threaded bridge; a fresh
# `piper` subprocess per utterance reloaded the ~100 MB model every time (5-7 s).
# The sidecar loads the voice ONCE; the bridge POSTs text, gets a WAV, and plays
# it via aplay on a background thread (pure I/O → GIL-friendly). Until the sidecar
# is ready, server_tts stays False so browser TTS covers the gap.
PIPER_MODEL = os.path.expanduser(os.environ.get("SIM_PIPER_MODEL") or "~/models/piper/en_US-amy-medium.onnx")


def _piper_deps_ok():
    try:
        return bool(importlib.util.find_spec("piper") and importlib.util.find_spec("flask")
                    and shutil.which("aplay") and os.path.exists(PIPER_MODEL))
    except Exception:
        return False


_PIPER_OK = _piper_deps_ok()
_piper_proc = None      # the sidecar process
_piper_port = None
_piper_ready = False    # True once the sidecar answers; gates server_tts
_tts_lock = threading.Lock()
_tts_process = None     # current aplay process


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def start_piper_sidecar():
    """Spawn the piper HTTP server; a watcher flips _piper_ready once it answers."""
    global _piper_proc, _piper_port
    if not _PIPER_OK or _piper_proc is not None:
        return
    _piper_port = _free_port()
    _piper_proc = subprocess.Popen(
        [sys.executable, "-m", "piper.http_server", "-m", PIPER_MODEL,
         "--host", "127.0.0.1", "--port", str(_piper_port)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    atexit.register(stop_piper_sidecar)
    threading.Thread(target=_wait_piper_ready, daemon=True).start()


def _wait_piper_ready():
    global _piper_ready
    url = f"http://127.0.0.1:{_piper_port}/"
    deadline = time.time() + 60
    while time.time() < deadline:
        if _piper_proc is None or _piper_proc.poll() is not None:
            print("[TTS] piper sidecar exited during startup")
            return
        try:
            # real word: the server errors on empty/punctuation-only text (no audio → no WAV channels)
            req = urllib.request.Request(url, data=b'{"text":"ready"}',
                                         headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=5):
                _piper_ready = True
                print(f"[TTS] Piper voice ready ({os.path.basename(PIPER_MODEL)})")
                return
        except Exception:
            time.sleep(0.5)
    print("[TTS] piper sidecar did not become ready in time")


def stop_piper_sidecar():
    global _piper_proc
    if _piper_proc and _piper_proc.poll() is None:
        _piper_proc.terminate()
        try:
            _piper_proc.wait(timeout=3)
        except Exception:
            _piper_proc.kill()
    _piper_proc = None


def _speak_worker(text):
    global _tts_process
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{_piper_port}/",
            data=json.dumps({"text": text}).encode(),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            wav = r.read()
    except Exception as e:
        print(f"[TTS] piper synth error: {e}")
        return
    with _tts_lock:
        if _tts_process and _tts_process.poll() is None:
            _tts_process.terminate()    # interrupt whatever is playing
        try:
            _tts_process = subprocess.Popen(["aplay", "-q"], stdin=subprocess.PIPE)
        except Exception as e:
            print(f"[TTS] aplay error: {e}")
            _tts_process = None
            return
        proc = _tts_process
    try:
        if proc.stdin:
            proc.stdin.write(wav)   # aplay -q reads format from the WAV header
            proc.stdin.close()
    except Exception:
        pass


def speak_local(text):
    """Synthesize+play via the piper sidecar on a background thread. No-op until
    the sidecar is ready (server_tts=False then, so browser TTS covers it)."""
    if _piper_ready and text:
        threading.Thread(target=_speak_worker, args=(text,), daemon=True).start()


def stop_local_tts():
    global _tts_process
    with _tts_lock:
        if _tts_process and _tts_process.poll() is None:
            _tts_process.terminate()


# ─── Webcam Manager ───────────────────────────────────────────────
class WebcamManager:
    """Manages laptop webcam as simulated Pepper camera."""

    def __init__(self):
        self.cap = None
        self.lock = threading.Lock()

    def open(self):
        if HAS_OPENCV and self.cap is None:
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                print("[WARN] Could not open webcam")
                self.cap = None

    def get_frame(self, width=640, height=480):
        """Capture a frame, return as base64 JPEG."""
        with self.lock:
            if self.cap is None or not self.cap.isOpened():
                return self._generate_placeholder(width, height)
            ret, frame = self.cap.read()
            if not ret:
                return self._generate_placeholder(width, height)
            frame = cv2.resize(frame, (width, height))
            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return base64.b64encode(jpeg.tobytes()).decode("utf-8")

    def _generate_placeholder(self, width, height):
        """Generate a placeholder image when no webcam available."""
        if HAS_OPENCV:
            import numpy as np
            img = np.zeros((height, width, 3), dtype=np.uint8)
            img[:] = (40, 40, 40)
            cv2.putText(img, "SIMULATOR CAM", (width // 4, height // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
            cv2.putText(img, "No webcam detected", (width // 4, height // 2 + 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150, 150, 150), 1)
            _, jpeg = cv2.imencode(".jpg", img)
            return base64.b64encode(jpeg.tobytes()).decode("utf-8")
        # Minimal 1x1 black JPEG
        return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM"

    def close(self):
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None


# ─── Audio Manager ─────────────────────────────────────────────────
class AudioManager:
    """Manages laptop mic as simulated Pepper microphone."""

    def __init__(self):
        self.pa = None
        self.stream = None

    def open(self):
        if HAS_PYAUDIO:
            try:
                self.pa = pyaudio.PyAudio()
                self.stream = self.pa.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=16000,
                    input=True,
                    frames_per_buffer=1024
                )
            except Exception as e:
                print(f"[WARN] Could not open mic: {e}")
                self.stream = None

    def record(self, seconds=5):
        """Record N seconds of audio, return as WAV bytes."""
        if not self.stream:
            return self._generate_silence(seconds)
        frames = []
        num_chunks = int(16000 * seconds / 1024)
        for _ in range(num_chunks):
            try:
                data = self.stream.read(1024, exception_on_overflow=False)
                frames.append(data)
            except Exception:
                break
        # Pack as WAV
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(16000)
            wf.writeframes(b"".join(frames))
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def get_chunk(self, chunk_size=4096):
        """Get a raw audio chunk for streaming."""
        if not self.stream:
            return base64.b64encode(b"\x00" * chunk_size).decode("utf-8")
        try:
            data = self.stream.read(chunk_size // 2, exception_on_overflow=False)
            return base64.b64encode(data).decode("utf-8")
        except Exception:
            return base64.b64encode(b"\x00" * chunk_size).decode("utf-8")

    def _generate_silence(self, seconds):
        """Generate silent audio when no mic available."""
        num_samples = int(16000 * seconds)
        silence = b"\x00\x00" * num_samples
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(silence)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def close(self):
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        if self.pa:
            self.pa.terminate()


# ─── Bridge Request Handler ──────────────────────────────────────
# ─── AI brain system prompt ───────────────────────────────────────
# Static persona + live grounding. The persona keeps Pepper in character and
# bounded to what its body can do (HRI/social, light nav — not manipulation).
# The live-context block is rebuilt every turn so the model never has to guess
# the date or its own state (the cause of it inventing "October 24, 2025").
ROBOT_PERSONA = (
    "You are Pepper, a friendly humanoid social robot. You're talking with a person "
    "face-to-face and your words are spoken aloud, so reply in 1-2 short, natural "
    "sentences. Use plain speech only: no markdown, lists, emojis, code, or URLs. "
    "You have a head you can turn, two arms for gestures, a wheeled base for light "
    "movement, eye LEDs, and a speaker. You are built for conversation, greeting "
    "people, and light navigation; you cannot pick up or manipulate objects, climb "
    "stairs, or run, so if asked to, say so kindly. Be warm, curious, and concise. "
    "Never invent names, facts, or dates. For the current time or your own state, "
    "use the live context below and trust it over your training; if you don't know, say so."
)


def build_system_prompt(state, now):
    """Persona + live grounding (date/time + robot state), rebuilt per turn.

    `state` is a pepper.to_dict() snapshot; `now` is a datetime. Grounding stops
    the model inventing the date and lets Pepper talk about its own state.
    """
    eyes = state.get("eye_color") or {}
    ctx = [
        "Now: " + now.strftime("%A, %d %B %Y, %H:%M"),
        "Battery: {}%{}".format(state.get("battery", "?"), " (charging)" if state.get("charging") else ""),
        "Posture: {}, {}".format(state.get("posture", "?"), "moving" if state.get("is_moving") else "standing still"),
        "Eyes: rgb({},{},{})".format(eyes.get("r", 255), eyes.get("g", 255), eyes.get("b", 255)),
    ]
    return ROBOT_PERSONA + "\n\nLive context (trust this over your training):\n" + "\n".join("- " + c for c in ctx)


class BridgeHandler(BaseHTTPRequestHandler):
    """
    HTTP handler matching EXACTLY the real Pepper bridge API.
    Every endpoint returns the same JSON structure as the real bridge.
    """

    # Only localhost origins get CORS. Prod serves the UI same-origin (no CORS
    # needed); the dev Vite server (:5002) is cross-origin and must be allowed.
    # Reflecting only local origins blocks any remote website the user visits
    # from driving the bridge — the Origin header is browser-set, unspoofable
    # by page JS — while curl/Python tests (no Origin) are unaffected.
    _CORS_HOSTS = ("localhost", "127.0.0.1", "::1")

    def _send_cors(self):
        origin = self.headers.get("Origin")
        if not origin:
            return
        try:
            host = urlparse(origin).hostname
        except ValueError:
            return
        if host in self._CORS_HOSTS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._send_cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def _serve_static(self, path):
        """Serve the built web UI from web/dist/. '/' → index.html."""
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        if "\x00" in rel:
            self._send_json({"success": False, "error": "Forbidden"}, 400)
            return
        dist_real = os.path.realpath(DIST_DIR)
        full = os.path.realpath(os.path.join(dist_real, rel))

        # Path-traversal guard: resolved path must stay inside dist.
        if full != dist_real and not full.startswith(dist_real + os.sep):
            self._send_json({"success": False, "error": "Forbidden"}, 403)
            return
        if not os.path.isfile(full):
            hint = "" if os.path.isdir(dist_real) else " (run: cd simulator/web && npm run build)"
            self._send_json({"success": False, "error": f"Not found: {path}{hint}"}, 404)
            return

        ctype, _ = mimetypes.guess_type(full)
        # index.html has a stable name, so a cached copy keeps loading an old,
        # pre-rebuild entry point (→ stale JS, e.g. missing the server_tts guard).
        # Force it to revalidate; content-hashed assets are safe to cache forever.
        if rel.startswith("assets/"):
            cache = "public, max-age=31536000, immutable"
        else:
            cache = "no-cache"
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self._send_cors()
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        body = self.rfile.read(length)
        try:
            return json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {"raw": base64.b64encode(body).decode("utf-8")}

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress default logging, we use our own
        pass

    # ─── GET routes ──────────────────────────────────────────────

    def do_GET(self):
        path = urlparse(self.path).path
        params = parse_qs(urlparse(self.path).query)

        routes = {
            "/health":         self._get_health,
            "/battery":        self._get_battery,
            "/camera/frame":   self._get_camera_frame,
            "/audio/stream":   self._get_audio_stream,
            "/speak/status":   self._get_speak_status,
            "/face/detect":    self._get_face_detect,
            "/animation/list": self._get_animation_list,
            "/navigate/position": self._get_nav_position,
            "/navigate/map":   self._get_nav_map,
            "/posture/current": self._get_current_posture,
            "/joints/angles":  self._get_joint_angles,
            "/ai/config":      self._get_ai_config,
            "/ai/runner/status": self._get_runner_status,
            "/ai/runner/models": self._get_runner_models,
            "/ai/provision/status": self._get_provision_status,
            "/robot/status":   self._get_robot_status,
            "/voice/status":   self._get_voice_status,
            "/services/status": self._get_services_status,
        }

        handler = routes.get(path)
        if handler:
            response = handler(params)
            if path not in ("/ai/runner/status", "/ai/provision/status", "/robot/status", "/voice/status", "/services/status"):  # UI polls these ~1.5s; don't flood the API log
                pepper.log_api_call(path, "GET", response=response)
            self._send_json(response)
        else:
            self._serve_static(path)

    def _get_health(self, params):
        return {
            "success": True,
            "data": {
                "status": "ok",
                "battery": round(pepper.battery, 1),
                "uptime": round(time.time() - pepper.boot_time),
                "simulator": True
            }
        }

    def _get_battery(self, params):
        return {
            "success": True,
            "data": {
                "level": round(pepper.battery, 1),
                "charging": pepper.charging
            }
        }

    def _get_camera_frame(self, params):
        camera = params.get("camera", ["top"])[0]
        width = int(params.get("width", [640])[0])
        height = int(params.get("height", [480])[0])
        frame_b64 = webcam.get_frame(width, height)
        return {
            "success": True,
            "data": {
                "image": frame_b64,
                "width": width,
                "height": height,
                "camera": camera,
                "format": "jpeg",
                "timestamp": time.time()
            }
        }

    def _get_audio_stream(self, params):
        chunk = audio_manager.get_chunk()
        return {
            "success": True,
            "data": {
                "audio": chunk,
                "sample_rate": 16000,
                "channels": 1,
                "format": "int16",
                "timestamp": time.time()
            }
        }

    def _get_speak_status(self, params):
        return {
            "success": True,
            "data": {"is_speaking": pepper.is_speaking}
        }

    def _get_face_detect(self, params):
        # Simulated — returns empty or mock detection
        return {
            "success": True,
            "data": {
                "faces": [],
                "timestamp": time.time()
            }
        }

    def _get_animation_list(self, params):
        return {
            "success": True,
            "data": {"animations": pepper.ANIMATIONS}
        }

    def _get_nav_position(self, params):
        pos = pepper.get_robot_position()
        return {
            "success": True,
            "data": {"x": pos[0], "y": pos[1], "theta": pos[2]}
        }

    def _get_nav_map(self, params):
        return {
            "success": True,
            "data": {
                "has_map": pepper.has_map,
                "grid": pepper.occupancy_grid,
                "resolution": 0.1,
                "width": 8.0,
                "height": 6.0,
                "objects": pepper.ROOM_OBJECTS
            }
        }

    def _get_current_posture(self, params):
        return {
            "success": True,
            "data": {"posture": pepper.posture}
        }

    def _get_joint_angles(self, params):
        names = params.get("names", ["Body"])[0]
        angles = pepper.get_angles(names)
        return {
            "success": True,
            "data": {"names": names, "angles": angles}
        }

    # ─── POST routes ─────────────────────────────────────────────

    # Robot-contract routes reject unknown body keys with a 400 instead of
    # silently no-op'ing ({"vx": 1} on /move/velocity used to return success
    # while doing nothing). Keys are the UNION of what this sim and the real
    # pepper/bridge.py read — keep in lockstep when either changes. Studio-side
    # routes (/ai/*, /robot/*, /voice/*, /services/*) validate in their handlers.
    ROBOT_PARAMS = {
        "/speak":             {"text", "language", "speed", "pitch"},
        "/speak/stop":        set(),
        "/audio/record":      {"seconds"},
        "/audio/play":        {"raw"},
        "/audio/stop":        set(),
        "/move/velocity":     {"x", "y", "theta"},
        "/move/to":           {"x", "y", "theta"},
        "/move/stop":         set(),
        "/posture/set":       {"posture", "speed"},
        "/head/set":          {"yaw", "pitch", "speed"},
        "/joints/set":        {"names", "angles", "speed"},
        "/joints/stiffness":  {"names", "values"},
        "/leds/eyes":         {"r", "g", "b"},
        "/leds/ears":         {"intensity"},
        "/animation/run":     {"name"},
        "/tablet/show/url":   {"url"},
        "/tablet/show/image": {"url"},
        "/tablet/hide":       set(),
        "/face/track/start":  set(),
        "/face/track/stop":   set(),
        "/autonomous/set":    {"enabled"},
        "/awareness/set":     {"enabled"},
        "/navigate/explore":  {"radius"},
        "/navigate/goto":     {"x", "y", "theta"},
        "/navigate/save":     set(),
        "/navigate/load":     {"path"},
        "/chat":              {"text"},
    }

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_body()

        allowed = self.ROBOT_PARAMS.get(path)
        if allowed is not None and isinstance(body, dict):
            unknown = set(body) - allowed
            if unknown:
                expected = ", ".join(sorted(allowed)) if allowed else "no parameters"
                response = {"success": False,
                            "error": f"unknown parameter(s) {', '.join(sorted(unknown))} "
                                     f"for {path} — expected: {expected}"}
                pepper.log_api_call(path, "POST", body=body, response=response)
                self._send_json(response, 400)
                return

        routes = {
            "/speak":              self._post_speak,
            "/speak/stop":         self._post_speak_stop,
            "/audio/record":       self._post_audio_record,
            "/audio/play":         self._post_audio_play,
            "/audio/stop":         self._post_audio_stop,
            "/move/velocity":      self._post_move_velocity,
            "/move/to":            self._post_move_to,
            "/move/stop":          self._post_move_stop,
            "/posture/set":        self._post_posture_set,
            "/head/set":           self._post_head_set,
            "/joints/set":         self._post_joints_set,
            "/joints/stiffness":   self._post_joints_stiffness,
            "/leds/eyes":          self._post_leds_eyes,
            "/leds/ears":          self._post_leds_ears,
            "/animation/run":      self._post_animation_run,
            "/tablet/show/url":    self._post_tablet_url,
            "/tablet/show/image":  self._post_tablet_image,
            "/tablet/hide":        self._post_tablet_hide,
            "/face/track/start":   self._post_face_track_start,
            "/face/track/stop":    self._post_face_track_stop,
            "/autonomous/set":     self._post_autonomous_set,
            "/awareness/set":      self._post_awareness_set,
            "/navigate/explore":   self._post_nav_explore,
            "/navigate/goto":      self._post_nav_goto,
            "/navigate/save":      self._post_nav_save,
            "/navigate/load":      self._post_nav_load,
            "/chat":               self._post_chat,
            "/search_results":     self._post_search_results,
            "/ai/config":          self._post_ai_config,
            "/ai/test":            self._post_ai_test,
            "/ai/runner/start":    self._post_runner_start,
            "/ai/runner/stop":     self._post_runner_stop,
            "/ai/provision/start": self._post_provision_start,
            "/robot/connect":      self._post_robot_connect,
            "/robot/disconnect":   self._post_robot_disconnect,
            "/voice/talk":         self._post_voice_talk,
            "/voice/clear":        self._post_voice_clear,
            "/services/searxng/start": self._post_searxng_start,
            "/services/searxng/stop":  self._post_searxng_stop,
        }

        handler = routes.get(path)
        if handler:
            response = handler(body)
            pepper.log_api_call(path, "POST", body=body, response=response)
            self._send_json(response)
        else:
            self._send_json({"success": False, "error": f"Unknown endpoint: {path}"}, 404)

    def _post_speak(self, body):
        text = body.get("text", "")
        language = body.get("language", "en")
        speed = body.get("speed", 100)
        pitch = body.get("pitch", 100)
        pepper.say(text, language, speed, pitch)
        speak_local(text)
        def finish():
            # playback is async (piper sidecar); estimate the spoken duration
            time.sleep(max(1.0, len(text.split()) * 0.15 * (100 / speed)))
            pepper.finish_speaking()
        threading.Thread(target=finish, daemon=True).start()
        print(f"[SPEAK] ({language}) {text}")
        return {"success": True, "data": {"duration_estimate": len(text.split()) * 0.15}}

    def _post_speak_stop(self, body):
        pepper.stop_speaking()
        stop_local_tts()
        return {"success": True, "data": {}}

    def _post_audio_record(self, body):
        seconds = body.get("seconds", 5)
        audio_b64 = audio_manager.record(seconds)
        return {
            "success": True,
            "data": {
                "audio": audio_b64,
                "duration": seconds,
                "sample_rate": 16000,
                "format": "wav"
            }
        }

    def _post_audio_play(self, body):
        print(f"[AUDIO PLAY] Playing audio on Pepper speakers")
        return {"success": True, "data": {}}

    def _post_audio_stop(self, body):
        print("[AUDIO STOP] Stopping audio playback")
        return {"success": True, "data": {}}

    def _post_move_velocity(self, body):
        vx = body.get("x", 0)
        vy = body.get("y", 0)
        vtheta = body.get("theta", 0)
        pepper.move_toward(vx, vy, vtheta)
        print(f"[MOVE] velocity x={vx} y={vy} θ={vtheta}")
        return {"success": True, "data": {}}

    def _post_move_to(self, body):
        x = body.get("x", 0)
        y = body.get("y", 0)
        theta = body.get("theta", 0)
        pepper.move_to(x, y, theta)
        print(f"[MOVE] to relative x={x} y={y} θ={theta}")
        return {"success": True, "data": {}}

    def _post_move_stop(self, body):
        pepper.stop_move()
        print("[MOVE] stopped")
        return {"success": True, "data": {}}

    def _post_posture_set(self, body):
        posture = body.get("posture", "StandInit")
        speed = body.get("speed", 0.5)
        result = pepper.go_to_posture(posture, speed)
        print(f"[POSTURE] → {posture}")
        return {"success": result, "data": {"posture": posture}}

    def _post_head_set(self, body):
        yaw = body.get("yaw", 0)
        pitch = body.get("pitch", 0)
        speed = body.get("speed", 0.2)
        pepper.set_angles(["HeadYaw", "HeadPitch"], [yaw, pitch], speed)
        return {"success": True, "data": {"yaw": yaw, "pitch": pitch}}

    def _post_joints_set(self, body):
        names = body.get("names", [])
        angles = body.get("angles", [])
        speed = body.get("speed", 0.2)
        pepper.set_angles(names, angles, speed)
        return {"success": True, "data": {"names": names, "angles": angles}}

    def _post_joints_stiffness(self, body):
        names = body.get("names", "Body")
        values = body.get("values", 1.0)
        pepper.set_stiffnesses(names, values)
        return {"success": True, "data": {}}

    def _post_leds_eyes(self, body):
        r = body.get("r", 255)
        g = body.get("g", 255)
        b = body.get("b", 255)
        pepper.set_eye_color(r, g, b)
        print(f"[LEDS] eyes → rgb({r},{g},{b})")
        return {"success": True, "data": {"r": r, "g": g, "b": b}}

    def _post_leds_ears(self, body):
        intensity = body.get("intensity", 1.0)
        pepper.ear_intensity = intensity
        return {"success": True, "data": {"intensity": intensity}}

    def _post_animation_run(self, body):
        name = body.get("name", "")
        pepper.current_animation = name
        print(f"[ANIMATION] {name}")
        # Clear after 3 seconds
        def clear():
            time.sleep(3)
            pepper.current_animation = None
        threading.Thread(target=clear, daemon=True).start()
        return {"success": True, "data": {"animation": name}}

    def _post_tablet_url(self, body):
        url = body.get("url", "")
        pepper.show_tablet_url(url)
        print(f"[TABLET] showing URL: {url}")
        return {"success": True, "data": {"url": url}}

    def _post_tablet_image(self, body):
        url = body.get("url", "")
        pepper.show_tablet_image(url)
        return {"success": True, "data": {"url": url}}

    def _post_tablet_hide(self, body):
        pepper.hide_tablet()
        return {"success": True, "data": {}}

    def _post_face_track_start(self, body):
        pepper.face_tracking = True
        return {"success": True, "data": {}}

    def _post_face_track_stop(self, body):
        pepper.face_tracking = False
        return {"success": True, "data": {}}

    def _post_autonomous_set(self, body):
        enabled = body.get("enabled", True)
        pepper.autonomous_life = enabled
        return {"success": True, "data": {"enabled": enabled}}

    def _post_awareness_set(self, body):
        enabled = body.get("enabled", True)
        pepper.basic_awareness = enabled
        return {"success": True, "data": {"enabled": enabled}}

    def _post_nav_explore(self, body):
        radius = body.get("radius", 3.0)
        pepper.is_exploring = True
        pepper.has_map = True
        print(f"[NAV] exploring radius={radius}m")
        def finish_explore():
            time.sleep(5)
            pepper.is_exploring = False
        threading.Thread(target=finish_explore, daemon=True).start()
        return {"success": True, "data": {"radius": radius}}

    def _post_nav_goto(self, body):
        x = body.get("x", 0)
        y = body.get("y", 0)
        theta = body.get("theta", 0)
        pepper.navigate_to(x, y, theta)
        print(f"[NAV] goto ({x}, {y}, θ={theta})")
        return {"success": True, "data": {"x": x, "y": y, "theta": theta}}

    def _post_nav_save(self, body):
        pepper.has_map = True
        return {"success": True, "data": {"path": "maps/sim_map.raw"}}

    def _post_nav_load(self, body):
        pepper.has_map = True
        return {"success": True, "data": {}}

    def _post_chat(self, body):
        global chat_history
        text = body.get("text", "")
        if not text:
            return {"success": False, "error": "No text provided"}
        print(f"[CHAT] User: {text}")

        chat_history.append({"role": "user", "content": text})
        if len(chat_history) > 20:
            chat_history = chat_history[-20:]

        response_text, routed_to = self._query_llm(text)

        pepper.say(response_text, "en")
        speak_local(response_text)
        def finish():
            # playback is async (piper sidecar); estimate the spoken duration
            time.sleep(max(1.0, len(response_text.split()) * 0.15))
            pepper.finish_speaking()
        threading.Thread(target=finish, daemon=True).start()

        chat_history.append({"role": "assistant", "content": response_text})

        return {
            "success": True,
            "data": {
                "response": response_text,
                "routed_to": routed_to,
                "tools_used": [],
            }
        }

    def _ai_config_data(self):
        # caller holds _ai_lock
        return {
            "base_url": _ai_cfg.get("base_url", ""),
            "model": _ai_cfg.get("model", "local"),
            "timeout": _ai_cfg.get("timeout", 60),
            "enabled": brain.enabled,
            "key_set": bool(_ai_cfg.get("api_key")),
        }

    def _get_ai_config(self, params):
        with _ai_lock:
            return {"success": True, "data": self._ai_config_data()}

    def _post_ai_config(self, body):
        global brain
        with _ai_lock:
            if "base_url" in body:
                _ai_cfg["base_url"] = str(body["base_url"]).rstrip("/")
            if "model" in body:
                _ai_cfg["model"] = str(body["model"]) or "local"
            if "timeout" in body:
                try:
                    _ai_cfg["timeout"] = max(5, min(600, int(body["timeout"])))
                except (TypeError, ValueError):
                    pass
            if "api_key" in body:
                _ai_cfg["api_key"] = str(body["api_key"])  # "" clears it
            ai_config.save(_ai_cfg)
            _rebuild_brain()
            return {"success": True, "data": self._ai_config_data()}

    def _post_ai_test(self, body):
        # NOTE: HTTPServer is single-threaded, so this blocks other requests for
        # up to `timeout`s. Kept short for that reason. (Threading the server is a
        # separate change — /chat has the same property.)
        client = SimLLMClient(
            base_url=str(body.get("base_url", "")).rstrip("/"),
            api_key=str(body.get("api_key", "")),
            model=str(body.get("model", "local")) or "local",
            timeout=5,
        )
        if not client.enabled:
            return {"success": False, "error": "No base_url provided"}
        resp = client.chat("ping")
        out = {"success": resp.success, "data": {"tok_per_sec": resp.tok_per_sec}}
        if not resp.success:
            out["error"] = resp.error
        return out

    def _get_runner_status(self, params):
        return {"success": True, "data": runner.status()}

    def _get_runner_models(self, params):
        d = params.get("dir", [""])[0]
        if d:
            _runner_cfg["models_dir"] = os.path.expanduser(d)
            runner.save(_runner_cfg)
        models_dir = _runner_cfg.get("models_dir", "")
        return {"success": True, "data": {"dir": models_dir, "models": runner.list_models(models_dir)}}

    def _post_runner_start(self, body):
        flags = {k: body.get(k) for k in ("ngl", "ctx", "cache_type", "flash_attn", "mmproj", "extra_args")}
        if body.get("models_dir") is not None:
            _runner_cfg["models_dir"] = os.path.expanduser(str(body["models_dir"]))
        if body.get("binary") is not None:
            _runner_cfg["binary"] = str(body["binary"])
        _runner_cfg["gguf"] = str(body.get("gguf", ""))
        _runner_cfg["flags"] = flags
        runner.save(_runner_cfg)
        gguf = str(body.get("gguf", ""))
        if gguf and not os.path.isabs(os.path.expanduser(gguf)) and _runner_cfg.get("models_dir"):
            gguf = os.path.join(_runner_cfg["models_dir"], gguf)
        return {"success": True, "data": runner.start(gguf, flags, binary=_runner_cfg.get("binary") or None)}

    def _post_runner_stop(self, body):
        return {"success": True, "data": runner.stop()}

    def _get_provision_status(self, params):
        data = dict(provision.status())
        data["bundle"] = BUNDLE
        data["provisioned"] = provision.is_provisioned()
        data["models"] = [{"id": k, "label": v["label"],
                           "default": k == provision.DEFAULT_CHOICE}
                          for k, v in provision.MODEL_CHOICES.items()]
        return {"success": True, "data": data}

    def _post_provision_start(self, body):
        if BUNDLE != "full":
            return {"success": False, "error": "auto-provisioning is only available in the 'full' build"}
        backend = (body.get("backend") or "").strip().lower() or None
        model = (body.get("model") or "").strip().lower() or None
        if model and model not in provision.MODEL_CHOICES:
            return {"success": False,
                    "error": f"unknown model '{model}' — options: {', '.join(provision.MODEL_CHOICES)}"}
        return {"success": True, "data": _start_provision(backend=backend, model=model)}

    # ── Robot connection (studio-side; deploys + runs bridge.py on a real Pepper) ──

    def _get_robot_status(self, params):
        return {"success": True, "data": connection.status()}

    def _post_robot_connect(self, body):
        host = (body.get("host") or "").strip()
        if not host:
            return {"success": False, "error": "host required"}
        connection.connect(
            host, (body.get("user") or "nao").strip(),
            password=body.get("password") or None,
            ssh_port=int(body.get("ssh_port") or 22),
            naoqi_port=int(body.get("naoqi_port") or 9559),
            bridge_port=int(body.get("bridge_port") or 5001),
        )
        return {"success": True, "data": connection.status()}

    def _post_robot_disconnect(self, body):
        connection.disconnect()
        return {"success": True, "data": connection.status()}

    # ── In-app voice (push-to-talk: record via bridge -> STT -> brain -> speak) ──

    def _get_voice_status(self, params):
        return {"success": True, "data": voice_service.status()}

    def _post_voice_talk(self, body):
        bridge_url = (body.get("bridge_url") or "").strip()
        if not bridge_url:
            return {"success": False, "error": "bridge_url required"}
        data = voice_service.talk(
            brain, bridge_url,
            seconds=float(body.get("seconds") or 5),
            model_size=str(body.get("model") or "small"),
            searxng_url=(body.get("searxng_url") or "").strip())
        return {"success": True, "data": data}

    def _post_voice_clear(self, body):
        voice_service.clear()
        return {"success": True, "data": voice_service.status()}

    # ── External services (docker-managed; SearXNG for web search) ──

    def _get_services_status(self, params):
        return {"success": True, "data": {"searxng": services.status()}}

    def _post_searxng_start(self, body):
        return {"success": True, "data": services.start()}

    def _post_searxng_stop(self, body):
        return {"success": True, "data": services.stop()}

    def _query_llm(self, text):
        """Try the configured AI → mock fallback."""
        system = build_system_prompt(pepper.to_dict(), datetime.datetime.now())
        history = chat_history[:-1] if chat_history else []

        if brain.enabled:
            resp = brain.chat(text, system=system, history=history)
            if resp.success and resp.content:
                print(f"[CHAT] AI: {resp.content} ({resp.tok_per_sec:.0f} tok/s)")
                return resp.content, "ai"
            print(f"[CHAT] AI failed: {resp.error}")

        print("[CHAT] AI unavailable, using mock response")
        mock_responses = [
            "Hello! I'm running in simulator mode right now.",
            "That's an interesting question! Let me think about it.",
            "I'm Pepper, nice to chat with you!",
            "No AI brain is configured. Set SIM_AI_BASE_URL to connect one.",
        ]
        idx = int(hashlib.md5(text.encode()).hexdigest(), 16) % len(mock_responses)
        return mock_responses[idx], "mock"

    def _post_search_results(self, body):
        query = body.get("query", "")
        results = body.get("results", [])
        pepper.push_search_result(query, results)
        print(f"[SEARCH] query='{query}' results={len(results)}")
        return {"success": True, "data": {"query": query, "count": len(results)}}


# ─── WebSocket State Broadcaster ────────────────────────────────
async def ws_handler(websocket):
    """Send state updates to 3D frontend every 50ms (20fps)."""
    ws_clients.add(websocket)
    try:
        while True:
            state = pepper.to_dict()
            state["server_tts"] = _piper_ready  # True only once the sidecar serves; browser TTS covers warmup
            await websocket.send(json.dumps(state))
            if state.get("search_results"):
                pepper.clear_search_results()
            await asyncio.sleep(0.05)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        ws_clients.discard(websocket)


async def start_ws_server():
    """Start the WebSocket server."""
    if not HAS_WEBSOCKETS:
        return
    server = await websockets.serve(ws_handler, "127.0.0.1", SIM_WS_PORT)
    print(f"[WS] State broadcast on ws://localhost:{SIM_WS_PORT}")
    await server.wait_closed()


def run_ws_in_thread():
    """Run WebSocket server in a background thread."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(start_ws_server())


# ─── Physics Loop ────────────────────────────────────────────────
def physics_loop():
    """Update physics at 60fps."""
    while True:
        pepper.update(1 / 60)
        time.sleep(1 / 60)


# ─── Main ────────────────────────────────────────────────────────
def main():
    global webcam, audio_manager

    print("=" * 60)
    print("  PEPPER SIMULATOR BRIDGE")
    print("  API-compatible with real Pepper NAOqi bridge")
    print("=" * 60)

    # Initialize hardware proxies
    webcam = WebcamManager()
    webcam.open()

    audio_manager = AudioManager()
    audio_manager.open()

    # Start physics thread
    physics_thread = threading.Thread(target=physics_loop, daemon=True)
    physics_thread.start()
    print("[PHYSICS] Running at 60fps")

    # Start WebSocket broadcast thread
    if HAS_WEBSOCKETS:
        ws_thread = threading.Thread(target=run_ws_in_thread, daemon=True)
        ws_thread.start()

    # Start the Piper TTS sidecar (separate process; loads the voice once)
    if _PIPER_OK:
        start_piper_sidecar()
        print("[TTS] Piper sidecar starting — browser TTS until the voice is ready")
    else:
        print("[TTS] Piper not available — browser TTS")

    # Start HTTP bridge server
    server = HTTPServer(("127.0.0.1", SIM_BRIDGE_PORT), BridgeHandler)
    print(f"[BRIDGE] Listening on http://localhost:{SIM_BRIDGE_PORT}")
    print(f"[INFO] Webcam: {'active' if webcam.cap else 'placeholder mode'}")
    print(f"[INFO] Mic: {'active' if audio_manager.stream else 'silent mode'}")
    print()
    print("  Middleware can now connect to this bridge.")
    print("  3D UI should connect to ws://localhost:5003")
    print("=" * 60)

    ui_url = f"http://localhost:{SIM_BRIDGE_PORT}"
    print(f"[UI] Open {ui_url}")
    if os.environ.get("SIM_OPEN_BROWSER", "1") == "1":
        import webbrowser
        # daemon so a Ctrl-C during the 1s window doesn't delay process exit
        opener = threading.Timer(1.0, lambda: webbrowser.open(ui_url))
        opener.daemon = True
        opener.start()

    atexit.register(runner.stop)
    atexit.register(connection.disconnect)  # never leave an orphan bridge on the robot
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))  # → atexit → runner.stop / disconnect

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Closing simulator...")
        runner.stop()
        webcam.close()
        audio_manager.close()
        server.server_close()


if __name__ == "__main__":
    main()
