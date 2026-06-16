"""Tests for stt.transcribe() — the graceful-degradation contract.

faster-whisper need not be installed: _get_model is monkeypatched with a fake
model so these run anywhere. We assert the (text, lang) tuple contract and that
every failure path returns ("", "") instead of raising into the voice loop.
"""
import os
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

import stt  # noqa: E402


class _Seg:
    def __init__(self, text):
        self.text = text


class _Info:
    def __init__(self, language):
        self.language = language


class FakeModel:
    """Returns scripted segments/info, or raises if told to."""
    def __init__(self, segments, language="en", raises=False):
        self._segments = segments
        self._language = language
        self._raises = raises

    def transcribe(self, audio, beam_size=1, language=None):
        if self._raises:
            raise RuntimeError("decode blew up")
        return list(self._segments), _Info(self._language)


def test_empty_bytes_returns_empty():
    assert stt.transcribe(b"") == ("", "")


def test_no_model_returns_empty(monkeypatch):
    # faster-whisper missing: _get_model yields None, must not crash.
    monkeypatch.setattr(stt, "_get_model", lambda *a, **k: None)
    assert stt.transcribe(b"somewav") == ("", "")


def test_happy_joins_segments_and_returns_lang(monkeypatch):
    model = FakeModel([_Seg("  Hello "), _Seg(" world ")], language="en")
    monkeypatch.setattr(stt, "_get_model", lambda *a, **k: model)
    text, lang = stt.transcribe(b"somewav")
    assert text == "Hello world"   # per-segment strip + space join
    assert lang == "en"


def test_detected_language_propagates(monkeypatch):
    model = FakeModel([_Seg("Hallo")], language="de")
    monkeypatch.setattr(stt, "_get_model", lambda *a, **k: model)
    _, lang = stt.transcribe(b"somewav", language=None)
    assert lang == "de"


def test_transcribe_failure_returns_empty(monkeypatch):
    model = FakeModel([], raises=True)
    monkeypatch.setattr(stt, "_get_model", lambda *a, **k: model)
    assert stt.transcribe(b"somewav") == ("", "")


def test_missing_language_info_is_empty_string(monkeypatch):
    model = FakeModel([_Seg("hi")], language=None)
    monkeypatch.setattr(stt, "_get_model", lambda *a, **k: model)
    text, lang = stt.transcribe(b"somewav")
    assert text == "hi"
    assert lang == ""              # info.language None -> "" not None
