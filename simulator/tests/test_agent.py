"""Tests for agent.respond() tool routing — especially multi-tool turns.

Uses a scripted MockBrain (chat_tools returns the tool calls we want) and a
FakeClient that records the bridge calls the executors make. No real LLM, no
real bridge — respond() takes both as args (dependency injection).
"""
import os
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

import agent  # noqa: E402
from llm import LLMResult  # noqa: E402


class MockBrain:
    def __init__(self, tool_calls=None, content="", chat_reply="fallback reply"):
        self._tool_calls = tool_calls or []
        self._content = content
        self._chat_reply = chat_reply

    def chat_tools(self, messages, tools):
        return LLMResult(success=True, content=self._content,
                         tool_calls=[dict(c) for c in self._tool_calls])

    def chat(self, question, system=None, history=None):
        return LLMResult(success=True, content=self._chat_reply)


class FakeClient:
    def __init__(self):
        self.calls = []

    def move_to(self, x, y, theta):
        self.calls.append(("move_to", x, y, theta))

    def wave(self):
        self.calls.append(("wave",))

    def set_joints(self, names, values):
        self.calls.append(("set_joints", tuple(names), tuple(values)))

    @property
    def methods(self):
        return [c[0] for c in self.calls]


# ── New behavior: every tool call in a turn runs, not just the first ──

def test_two_actions_both_execute():
    brain = MockBrain(tool_calls=[
        {"name": "turn", "args": {"direction": "left", "angle_deg": 45}},
        {"name": "wave", "args": {}},
    ])
    client = FakeClient()
    agent.respond(brain, client, "sys", "turn left and wave", [])
    assert "move_to" in client.methods   # the turn
    assert "wave" in client.methods       # the wave — previously dropped


def test_two_actions_reply_combines_confirmations():
    brain = MockBrain(tool_calls=[
        {"name": "turn", "args": {"direction": "left"}},
        {"name": "wave", "args": {}},
    ], content="")
    client = FakeClient()
    text, kind = agent.respond(brain, client, "sys", "q", [])
    assert "Turning left" in text
    assert "Hello there" in text
    assert kind.startswith("action:")


def test_action_then_game_both_run():
    brain = MockBrain(tool_calls=[
        {"name": "wave", "args": {}},
        {"name": "play_rps", "args": {}},
    ])
    client = FakeClient()
    text, kind = agent.respond(brain, client, "sys", "wave then play", [])
    assert "wave" in client.methods         # action executed
    assert "set_joints" in client.methods   # rps ran (hand pose)
    assert kind == "game"


# ── Regression: single-intent behavior is unchanged ──

def test_single_action_still_executes():
    brain = MockBrain(tool_calls=[{"name": "move", "args": {"direction": "forward"}}])
    client = FakeClient()
    text, kind = agent.respond(brain, client, "sys", "come closer", [])
    assert "move_to" in client.methods
    assert kind == "action:move"


def test_no_tool_call_is_chat():
    brain = MockBrain(tool_calls=[], content="Hi, I'm Pepper!")
    client = FakeClient()
    text, kind = agent.respond(brain, client, "sys", "what's your name", [])
    assert kind == "chat"
    assert text == "Hi, I'm Pepper!"
    assert client.calls == []


# ── Terminal tools: web search ──

def test_web_search_routes_and_synthesizes(monkeypatch):
    # No SearXNG, no network: stub the search calls. brain.chat returns the
    # synthesized spoken answer (MockBrain.chat -> chat_reply).
    monkeypatch.setattr(agent.search, "search",
                        lambda query, url, n=8: [{"title": "t", "content": "22C"}])
    monkeypatch.setattr(agent.search, "format_results", lambda results: "formatted")
    brain = MockBrain(
        tool_calls=[{"name": "web_search", "args": {"query": "weather in paris"}}],
        chat_reply="It's 22 degrees in Paris.",
    )
    client = FakeClient()
    text, kind = agent.respond(brain, client, "sys", "weather?", [],
                               searxng_url="http://searx.local")
    assert kind == "search"
    assert text == "It's 22 degrees in Paris."


def test_web_search_ignored_without_searxng_url(monkeypatch):
    # The tool isn't offered when SearXNG is unconfigured; if the model somehow
    # still asks for it, respond() must not route to search — it falls through.
    called = {"search": False}
    monkeypatch.setattr(agent.search, "search",
                        lambda *a, **k: called.__setitem__("search", True) or [])
    brain = MockBrain(tool_calls=[{"name": "web_search", "args": {"query": "x"}}],
                      content="", chat_reply="fallback")
    text, kind = agent.respond(brain, client := FakeClient(), "sys", "q", [],
                               searxng_url="")
    assert called["search"] is False
    assert kind == "chat"


# ── Terminal tools: music ──

def test_play_song_routes_to_music(monkeypatch):
    monkeypatch.setattr(agent.music, "play_song",
                        lambda client, query, **k: f"Now playing {query}")
    brain = MockBrain(tool_calls=[
        {"name": "play_song", "args": {"query": "bohemian rhapsody"}}])
    text, kind = agent.respond(brain, FakeClient(), "sys", "play a song", [])
    assert kind == "music"
    assert text == "Now playing bohemian rhapsody"


def test_stop_audio_routes_to_music(monkeypatch):
    monkeypatch.setattr(agent.music, "stop_audio", lambda client: "Stopped.")
    brain = MockBrain(tool_calls=[{"name": "stop_audio", "args": {}}])
    text, kind = agent.respond(brain, FakeClient(), "sys", "stop", [])
    assert kind == "music"
    assert text == "Stopped."


def test_action_then_music_action_runs_music_owns_reply(monkeypatch):
    # Robot action is a physical side effect; the music call is terminal and
    # owns the spoken reply.
    monkeypatch.setattr(agent.music, "play_song",
                        lambda client, query, **k: "Now playing it")
    brain = MockBrain(tool_calls=[
        {"name": "wave", "args": {}},
        {"name": "play_song", "args": {"query": "jazz"}},
    ])
    client = FakeClient()
    text, kind = agent.respond(brain, client, "sys", "wave then play jazz", [])
    assert "wave" in client.methods    # action still executed
    assert kind == "music"
    assert text == "Now playing it"
