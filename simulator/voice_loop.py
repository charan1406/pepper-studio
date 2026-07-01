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

# Sibling modules (agent/stt/llm) live in this dir. The bridge HTTP client lives
# in the repo root (pepper/client.py) — imported lazily in main() so importing
# this module never adds the repo root to sys.path (keeps sim_bridge decoupled).
sys.path.insert(0, os.path.dirname(__file__))

import agent
import stt
from llm import SimLLMClient

PEPPER_SYSTEM = (
    "You are Pepper, a friendly humanoid robot in a short, spoken, face-to-face "
    "conversation. Your words are read aloud by a text-to-speech voice. Follow every "
    "rule below exactly.\n"
    "1. LENGTH: Reply in at most two spoken sentences, under 25 words total. Plain words "
    "only — no markdown, no lists, no headings, no emoji, no asterisks, no stage "
    "directions. Be warm and natural, never robotic or manual-like.\n"
    "2. LANGUAGE: Reply ONLY in English or German. If the person speaks German, answer in "
    "German; otherwise always answer in English. Never use any other language or script.\n"
    "3. FACTS: You do not know current information — weather, news, sports scores, prices, "
    "opening hours, recent events. To get ANY such fact you MUST call the web_search tool "
    "in this same turn, then answer from its results. That tool is your only way to check "
    "anything; you cannot look things up later. Never answer a current fact from memory, "
    "and never reply 'I need to check', 'let me look it up', or 'I'll get back to you' — "
    "those do nothing. Call web_search instead. Only if its results lack the fact, say so "
    "in one short sentence.\n"
    "4. UNITS: Always use metric — degrees Celsius and kilometres — unless asked otherwise.\n"
    "5. ACTIONS: When the person asks you to move, turn, wave, play music, stop the music, "
    "or play a game, you MUST call the matching tool — every single time, even if you just "
    "did something similar. Describing the action in words does NOT move the robot; only "
    "calling the tool does. Never narrate an action instead of calling its tool."
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


def one_turn(client, brain, history, seconds, model_size, searxng_url=None):
    print(f"\n[listening {seconds}s] ...", flush=True)
    client.eyes_listening()
    b64 = client.record_audio(seconds)
    if not b64:
        print("[loop] bridge returned no audio (mic off, or /audio/record failed)")
        return
    wav = base64.b64decode(b64)

    client.eyes_thinking()
    # SIM_STT_LANGUAGE forces one language (e.g. "de") for a known-language
    # session; unset = auto-detect, but locked to English/German in stt (any
    # other detection is re-transcribed as English so no stray language leaks in).
    forced_lang = os.environ.get("SIM_STT_LANGUAGE") or None
    heard, lang = stt.transcribe(wav, size=model_size, language=forced_lang)
    if not heard:
        print("[loop] heard nothing (silence or STT unavailable)")
        client.eyes_listening()
        return
    print(f"[heard ] ({lang}) {heard}")

    if brain.enabled:
        # searxng_url=None means "fall back to env" (CLI default); the in-app
        # caller passes an explicit URL (a setting), "" to disable web search.
        sx = searxng_url if searxng_url is not None else os.environ.get("SIM_SEARXNG_URL", "")
        reply, kind = agent.respond(brain, client, PEPPER_SYSTEM, heard, history, sx)
        print(f"[{kind}]")
    else:
        reply, kind = "I heard you, but I have no AI brain configured yet.", "chat"
    print(f"[reply ] {reply}")

    # Locked to English/German (product choice; both voices installed per probe).
    # STT already clamps to en/de, so this is the final guard before setLanguage.
    speak_lang = lang if lang in ("en", "de") else "en"
    client.eyes_speaking()
    client.speak(reply, language=speak_lang)

    # Only conversational turns (chat/search) go into history. Physical actions,
    # music and games are imperative side-effects; storing their spoken
    # confirmation ("Okay, moving forward") as plain text teaches the model to
    # NARRATE the action next time instead of calling the tool — the exact
    # degradation seen on the real robot after the first successful move.
    if kind in ("chat", "search"):
        history.append({"role": "user", "content": heard})
        history.append({"role": "assistant", "content": reply})
        if len(history) > 20:
            del history[:-20]

    return {"heard": heard, "lang": lang, "reply": reply, "kind": kind}


def main():
    ap = argparse.ArgumentParser(description="Pepper voice loop (record -> STT -> LLM -> speak)")
    ap.add_argument("--bridge", default="http://localhost:5001", help="bridge URL (sim or real Pepper)")
    ap.add_argument("--seconds", type=float, default=5, help="seconds to record per turn")
    ap.add_argument("--model", default="small", help="faster-whisper size (tiny/base/small/medium)")
    ap.add_argument("--loop", action="store_true", help="keep going turn after turn")
    args = ap.parse_args()

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from pepper.client import PepperClient
    client = PepperClient(args.bridge)
    if not client.is_alive():
        print(f"[fatal] no bridge at {args.bridge} — start it or fix the URL")
        sys.exit(1)

    brain = build_brain()
    print(f"bridge : {args.bridge}")
    print(f"brain  : {'on — ' + brain.base_url if brain.enabled else 'off (set SIM_AI_BASE_URL)'}")
    print(f"stt    : {'faster-whisper ' + args.model if stt.HAS_WHISPER else 'UNAVAILABLE (pip install faster-whisper)'}")
    _searx = os.environ.get("SIM_SEARXNG_URL", "")
    print(f"search : {'on — ' + _searx if _searx else 'off (set SIM_SEARXNG_URL)'}")

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
