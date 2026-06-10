"""Voice loop driver: Pepper hears you -> LLM thinks -> Pepper speaks.

Studio-side orchestration. The real bridge (NAOqi, Python 2.7) can run neither
faster-whisper nor the LLM, so the loop lives here and only calls the robot's
HTTP contract: POST /audio/record to listen, POST /speak to answer. Point it at
any bridge URL — the sim (:5001) or a real Pepper — the loop is identical.

    record(bridge) -> base64 WAV
      -> stt.transcribe (faster-whisper, local)
      -> brain.chat (OpenAI-compatible, your SIM_AI_* dial)
      -> speak(bridge)

Usage:
    python voice_loop.py                         # sim, one turn (press Enter to record)
    python voice_loop.py --bridge http://<robot>:5001 --loop
    python voice_loop.py --seconds 6 --model small
"""
import argparse
import base64
import os
import sys

# Import the bridge HTTP client from the repo root and the sibling stt module.
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stt
from llm import SimLLMClient
from pepper.client import PepperClient

PEPPER_SYSTEM = (
    "You are Pepper, a friendly humanoid robot having a spoken, face-to-face "
    "conversation. Everything you say is read aloud by a text-to-speech voice, so keep "
    "replies to one or two short, natural sentences — plain conversational language, no "
    "markdown, no lists, no emoji, no stage directions or asterisks. Be warm, curious, and "
    "concise, like a friendly person rather than an assistant reading a manual. If you are "
    "asked something you cannot know right now — today's weather, the news, the current "
    "time — say so briefly in one sentence instead of guessing. /no_think"
)


def build_brain():
    """One dial: SIM_AI_BASE_URL / SIM_AI_API_KEY / SIM_AI_MODEL, same as the bridge."""
    return SimLLMClient(
        base_url=os.environ.get("SIM_AI_BASE_URL", ""),
        api_key=os.environ.get("SIM_AI_API_KEY", ""),
        model=os.environ.get("SIM_AI_MODEL", "local"),
        # reasoning models can generate for a while; give them room before timing out
        timeout=int(os.environ.get("SIM_AI_TIMEOUT", "120")),
    )


def one_turn(client, brain, history, seconds, model_size):
    print(f"\n[listening {seconds}s] ...", flush=True)
    client.eyes_listening()
    b64 = client.record_audio(seconds)
    if not b64:
        print("[loop] bridge returned no audio (mic off, or /audio/record failed)")
        return
    wav = base64.b64decode(b64)

    client.eyes_thinking()
    heard = stt.transcribe(wav, size=model_size)
    if not heard:
        print("[loop] heard nothing (silence or STT unavailable)")
        client.eyes_listening()
        return
    print(f"[heard ] {heard}")

    if brain.enabled:
        resp = brain.chat(heard, system=PEPPER_SYSTEM, history=history)
        reply = resp.content if resp.success else None
        if not reply:
            print(f"[loop] brain failed: {resp.error}")
            reply = "Sorry, my brain is not connected right now."
    else:
        reply = "I heard you, but I have no AI brain configured yet."
    print(f"[reply ] {reply}")

    client.eyes_speaking()
    client.speak(reply)

    history.append({"role": "user", "content": heard})
    history.append({"role": "assistant", "content": reply})
    if len(history) > 20:
        del history[:-20]


def main():
    ap = argparse.ArgumentParser(description="Pepper voice loop (record -> STT -> LLM -> speak)")
    ap.add_argument("--bridge", default="http://localhost:5001", help="bridge URL (sim or real Pepper)")
    ap.add_argument("--seconds", type=float, default=5, help="seconds to record per turn")
    ap.add_argument("--model", default="small", help="faster-whisper size (tiny/base/small/medium)")
    ap.add_argument("--loop", action="store_true", help="keep going turn after turn")
    args = ap.parse_args()

    client = PepperClient(args.bridge)
    if not client.is_alive():
        print(f"[fatal] no bridge at {args.bridge} — start it or fix the URL")
        sys.exit(1)

    brain = build_brain()
    print(f"bridge : {args.bridge}")
    print(f"brain  : {'on — ' + brain.base_url if brain.enabled else 'off (set SIM_AI_BASE_URL)'}")
    print(f"stt    : {'faster-whisper ' + args.model if stt.HAS_WHISPER else 'UNAVAILABLE (pip install faster-whisper)'}")

    history: list = []
    try:
        if args.loop:
            print("\nLoop mode. Ctrl-C to stop.")
            while True:
                input("press Enter to talk to Pepper... ")
                try:
                    one_turn(client, brain, history, args.seconds, args.model)
                except Exception as e:
                    # one bad turn (timeout, bridge blip) must not kill the session
                    print(f"[loop] turn failed: {type(e).__name__}: {e} — continuing")
        else:
            input("\npress Enter to talk to Pepper... ")
            one_turn(client, brain, history, args.seconds, args.model)
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
