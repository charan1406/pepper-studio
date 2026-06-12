"""Tool-call routing eval for the Pepper voice-loop brain (manual / live model).

This is NOT a unit test — it needs a running llama-server with the real GGUF, so
it lives in evals/ (not tests/) and is run by hand, e.g.:

    ~/llama.cpp/build/bin/llama-server \
        -m ~/models/Qwen2.5-3B-Instruct-Q4_K_M.gguf \
        --jinja --host 127.0.0.1 --port 8090 -ngl 99 -c 4096

    EVAL_BASE_URL=http://127.0.0.1:8090/v1 python simulator/evals/tool_routing_eval.py

`--jinja` is mandatory for tool-calling in llama.cpp.

It evaluates the ROUTING decision only (brain.chat_tools -> which tool the model
picks), so there are NO side effects: no yt-dlp downloads, no audio, no bridge,
no real web search. Two parts:

  1. SCORED  — labeled prompts, pass/fail per category. Catches the two failure
               modes: under-fire (action request -> no tool) and over-fire
               (plain chat -> a tool).
  2. STRESS  — multi-intent and hallucination prompts where "correct" is fuzzy;
               prints the FULL tool-call list so you can see (a) whether the model
               emits multiple calls and (b) whether it invents tools. agent.respond()
               now runs ALL action calls in order plus the first search/music/game
               tool, so multi-action turns ("turn and wave") execute fully.
"""
import os
import sys

SIM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM)
sys.path.insert(0, os.path.dirname(SIM))

import actions
import games
import music
import search
from llm import SimLLMClient

BASE_URL = os.environ.get("EVAL_BASE_URL", "http://127.0.0.1:8090/v1")

# Keep in sync with voice_loop.PEPPER_SYSTEM (copied to avoid importing stt/torch).
PEPPER_SYSTEM = (
    "You are Pepper, a friendly humanoid robot having a spoken, face-to-face "
    "conversation. Everything you say is read aloud by a text-to-speech voice, so keep "
    "replies to one or two short, natural sentences — plain conversational language, no "
    "markdown, no lists, no emoji, no stage directions or asterisks. Be warm, curious, and "
    "concise, like a friendly person rather than an assistant reading a manual. If you are "
    "asked something you cannot know on your own, use web search if it is available, "
    "otherwise say so briefly in one sentence instead of guessing. "
    "Always reply in the same language the person spoke to you."
)

# Full tool set, INCLUDING web_search so search routing is testable. (In production
# web_search is only offered when SIM_SEARXNG_URL is set.)
TOOLS = list(actions.ACTION_TOOLS) + [games.RPS_TOOL]
if music.HAS_YTDLP:
    TOOLS += music.MUSIC_TOOLS
TOOLS.append(search.WEB_SEARCH_TOOL)

# (utterance, expected tool name | "chat")
SCORED = [
    ("Pepper, come closer to me.",                 "move"),
    ("Can you back up a little?",                  "move"),
    ("Move forward a bit.",                        "move"),
    ("Take a step back.",                          "move"),
    ("Turn to your left.",                         "turn"),
    ("Turn right, please.",                        "turn"),
    ("Spin around to face the door.",              "turn"),
    ("Rotate a little to your left.",              "turn"),
    ("Wave hello!",                                "wave"),
    ("Can you wave at the camera?",                "wave"),
    ("Give everyone a little wave.",               "wave"),
    ("Let's play rock paper scissors.",            "play_rps"),
    ("Do you want to play rock paper scissors?",   "play_rps"),
    ("What's your name?",                          "chat"),
    ("How are you feeling today?",                 "chat"),
    ("Tell me a short joke.",                      "chat"),
    ("What kinds of things can you do?",           "chat"),
    ("I had a really long day.",                   "chat"),
    ("Do you like music?",                         "chat"),
    ("It's a nice day, isn't it?",                 "chat"),
]

# Multi-intent / hallucination probes. No single right answer — observe behaviour.
STRESS = [
    ("complex-search",  "What's the population of the capital city of Australia?"),
    ("complex-search",  "Who is the current Formula 1 world champion and how many points do they have?"),
    ("multi-search",    "What's the weather in Tokyo right now and what time is it in London?"),
    ("multi-search",    "Tell me today's top news headline and the current price of Bitcoin."),
    ("multi-action",    "Wave and then come closer."),
    ("multi-action",    "Turn left and wave at everyone."),
    ("multi-action",    "Spin around and back up a little."),
    ("action+search",   "Tell me today's news and follow me."),
    ("action+search",   "Wave hello and tell me what the weather is like."),
    ("no-capability",   "Follow me around the room."),
    ("no-capability",   "Pick up that cup and hand it to me."),
    ("no-capability",   "Do a backflip!"),
]


def call(client, text):
    """Return (list_of_(name,args), content). Empty list = no tool call."""
    msgs = [{"role": "system", "content": PEPPER_SYSTEM},
            {"role": "user", "content": text}]
    r = client.chat_tools(msgs, TOOLS)
    if not r.success:
        return None, f"ERR: {r.error}"
    return [(c["name"], c["args"]) for c in (r.tool_calls or [])], (r.content or "")


def run_scored(client):
    correct = 0
    by_cat = {}
    fails = []
    for text, expected in SCORED:
        calls, _ = call(client, text)
        got = calls[0][0] if calls else "chat"
        ok = got == expected
        c = by_cat.setdefault(expected, [0, 0]); c[1] += 1
        if ok:
            c[0] += 1; correct += 1
        else:
            mode = ("under-fire" if expected != "chat" and got == "chat"
                    else "over-fire" if expected == "chat" and got != "chat"
                    else "wrong-tool")
            fails.append((text, expected, got, mode))
    print(f"===== SCORED: {correct}/{len(SCORED)} = {100*correct/len(SCORED):.0f}% =====")
    for cat in ("move", "turn", "wave", "play_rps", "chat"):
        if cat in by_cat:
            print(f"  {cat:9} {by_cat[cat][0]}/{by_cat[cat][1]}")
    for text, exp, got, mode in fails:
        print(f"  [{mode:10}] want {exp:9} got {got:12} :: {text}")


def run_stress(client):
    print("\n===== STRESS (observational — full tool-call list) =====")
    print("(agent.respond() runs ALL action calls + the first search/music/game tool)\n")
    for cat, text in STRESS:
        calls, content = call(client, text)
        if calls is None:
            print(f"  [{cat:14}] {content}  :: {text}"); continue
        names = ", ".join(f"{n}({', '.join(f'{k}={v}' for k, v in a.items())})" for n, a in calls) or "—"
        flag = "  <-- MULTI" if len(calls) > 1 else ""
        print(f"  [{cat:14}] {len(calls)} call(s): {names}{flag}")
        print(f"  {'':16} :: {text}")
        if content:
            print(f"  {'':16} said: {content[:100]}")


if __name__ == "__main__":
    print(f"server: {BASE_URL}")
    print(f"tools : {[t['function']['name'] for t in TOOLS]}\n")
    c = SimLLMClient(base_url=BASE_URL, api_key="", model="local", timeout=60)
    run_scored(c)
    run_stress(c)
