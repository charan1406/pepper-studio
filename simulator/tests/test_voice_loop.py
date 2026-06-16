"""Tests for voice_loop.one_turn() orchestration: record -> STT -> brain -> speak.

The headline voice feature. No mic, no whisper, no LLM, no bridge: stt.transcribe
and agent.respond are monkeypatched, and a FakeClient records the bridge calls
one_turn makes. We assert the wiring — what gets recorded, transcribed, spoken,
the language fallback, and the conversation history bookkeeping.
"""
import base64
import os
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)
sys.path.insert(0, os.path.dirname(SIM_DIR))  # repo root, for pepper.client

import voice_loop  # noqa: E402

WAV = b"RIFFfake-wav-bytes"
B64 = base64.b64encode(WAV).decode()


class FakeClient:
    def __init__(self, audio=B64):
        self._audio = audio
        self.spoke = []          # list of (text, language)
        self.eyes = []           # ordered eye-state transitions
        self.recorded = []       # seconds passed to record_audio

    def eyes_listening(self):
        self.eyes.append("listening")

    def eyes_thinking(self):
        self.eyes.append("thinking")

    def eyes_speaking(self):
        self.eyes.append("speaking")

    def record_audio(self, seconds):
        self.recorded.append(seconds)
        return self._audio

    def speak(self, text, language="en"):
        self.spoke.append((text, language))


class FakeBrain:
    def __init__(self, enabled=True):
        self.enabled = enabled


def _patch(monkeypatch, transcribe_ret=("Hello there", "en"),
           respond_ret=("Hi, I'm Pepper!", "chat")):
    seen = {}

    def fake_transcribe(wav, size="small", language=None):
        seen["wav"] = wav
        seen["size"] = size
        seen["language"] = language
        return transcribe_ret

    def fake_respond(brain, client, system, question, history, searxng_url=""):
        seen["question"] = question
        seen["history_len_at_call"] = len(history)
        return respond_ret

    monkeypatch.setattr(voice_loop.stt, "transcribe", fake_transcribe)
    monkeypatch.setattr(voice_loop.agent, "respond", fake_respond)
    return seen


def test_happy_path_records_transcribes_speaks(monkeypatch):
    seen = _patch(monkeypatch)
    client = FakeClient()
    history = []
    voice_loop.one_turn(client, FakeBrain(), history, seconds=5, model_size="small")

    assert client.recorded == [5]
    assert seen["wav"] == WAV               # base64 decoded before STT
    assert seen["question"] == "Hello there"
    assert client.spoke == [("Hi, I'm Pepper!", "en")]
    # one user + one assistant turn appended
    assert history == [
        {"role": "user", "content": "Hello there"},
        {"role": "assistant", "content": "Hi, I'm Pepper!"},
    ]


def test_no_audio_returns_early(monkeypatch):
    seen = _patch(monkeypatch)
    client = FakeClient(audio="")        # bridge mic off / record failed
    history = []
    voice_loop.one_turn(client, FakeBrain(), history, 5, "small")

    assert "wav" not in seen             # never reached STT
    assert client.spoke == []
    assert history == []


def test_silence_does_not_speak(monkeypatch):
    seen = _patch(monkeypatch, transcribe_ret=("", ""))  # heard nothing
    client = FakeClient()
    history = []
    voice_loop.one_turn(client, FakeBrain(), history, 5, "small")

    assert "question" not in seen        # never reached the brain
    assert client.spoke == []
    assert history == []
    assert client.eyes[-1] == "listening"  # eyes reset to listening


def test_unknown_language_falls_back_to_english(monkeypatch):
    # Pepper has only en/de/zh voices; French must speak with the English voice.
    _patch(monkeypatch, transcribe_ret=("Bonjour", "fr"),
           respond_ret=("Bonjour!", "chat"))
    client = FakeClient()
    voice_loop.one_turn(client, FakeBrain(), [], 5, "small")
    assert client.spoke == [("Bonjour!", "en")]


def test_installed_language_kept(monkeypatch):
    _patch(monkeypatch, transcribe_ret=("Hallo", "de"),
           respond_ret=("Hallo!", "chat"))
    client = FakeClient()
    voice_loop.one_turn(client, FakeBrain(), [], 5, "small")
    assert client.spoke == [("Hallo!", "de")]


def test_brain_off_speaks_placeholder(monkeypatch):
    seen = _patch(monkeypatch)
    client = FakeClient()
    voice_loop.one_turn(client, FakeBrain(enabled=False), [], 5, "small")

    assert "question" not in seen        # agent.respond never called
    assert len(client.spoke) == 1
    assert "no AI brain" in client.spoke[0][0]


def test_action_turns_stay_out_of_history(monkeypatch):
    # Physical actions must NOT pollute history, or the model learns to narrate
    # ("Okay, moving forward") instead of calling the move tool next turn.
    _patch(monkeypatch, respond_ret=("Okay, moving backward.", "action:move"))
    client = FakeClient()
    history = []
    voice_loop.one_turn(client, FakeBrain(), history, 5, "small")
    assert client.spoke == [("Okay, moving backward.", "en")]  # still spoken
    assert history == []                                        # but not stored


def test_search_turns_are_kept_in_history(monkeypatch):
    _patch(monkeypatch, respond_ret=("It's 14 degrees.", "search"))
    client = FakeClient()
    history = []
    voice_loop.one_turn(client, FakeBrain(), history, 5, "small")
    assert len(history) == 2          # chat/search turns are conversational context


def test_history_truncates_to_20(monkeypatch):
    _patch(monkeypatch)
    client = FakeClient()
    history = [{"role": "user", "content": f"m{i}"} for i in range(30)]
    voice_loop.one_turn(client, FakeBrain(), history, 5, "small")
    assert len(history) == 20            # trimmed to the last 20 messages


def test_forced_language_passed_to_stt(monkeypatch):
    seen = _patch(monkeypatch)
    monkeypatch.setenv("SIM_STT_LANGUAGE", "de")
    voice_loop.one_turn(FakeClient(), FakeBrain(), [], 5, "small")
    assert seen["language"] == "de"


def test_auto_detect_when_no_forced_language(monkeypatch):
    seen = _patch(monkeypatch)
    monkeypatch.delenv("SIM_STT_LANGUAGE", raising=False)
    voice_loop.one_turn(FakeClient(), FakeBrain(), [], 5, "small")
    assert seen["language"] is None      # auto-detect per utterance
