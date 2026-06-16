"""Optional local speech-to-text via faster-whisper.

Transcribes Pepper's recorded mic audio (WAV bytes from POST /audio/record) into
text for the AI brain. Bring-your-own and optional, mirroring the Piper/pyaudio
pattern: if faster-whisper isn't installed, transcribe() returns "" and the voice
loop simply has no input rather than crashing.

The model loads lazily on first use and stays warm (load ~1.5s, then ~2s per a
few seconds of audio on CPU int8). Pepper records 16kHz mono; faster-whisper
resamples internally via PyAV, so any rate/channel layout is accepted.
"""
import io

try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False
    print("[WARN] faster-whisper not installed. STT disabled "
          "(pip install faster-whisper). Voice loop will have no input.")

_model = None
_loaded = None  # (size, device, compute_type) of the warm model


def _get_model(size="small", device="cpu", compute_type="int8"):
    global _model, _loaded
    if not HAS_WHISPER:
        return None
    key = (size, device, compute_type)
    if _model is None or _loaded != key:
        _model = WhisperModel(size, device=device, compute_type=compute_type)
        _loaded = key
    return _model


def _run(model, wav_bytes, language):
    segments, info = model.transcribe(
        io.BytesIO(wav_bytes), beam_size=1, language=language)
    text = " ".join(s.text.strip() for s in segments).strip()
    return text, (info.language or "")


def transcribe(wav_bytes, size="small", language=None, allowed=("en", "de"),
               device="cpu", compute_type="int8"):
    """Transcribe WAV bytes. Returns (text, lang) where lang is the ISO code.

    language=None auto-detects, but the result is LOCKED to `allowed`: a
    detection outside it — usually a whisper hallucination on noise/unclear
    speech, or a genuinely unsupported language — is re-transcribed as the first
    allowed language, so the robot never hears (or answers in) a stray tongue.
    Pass language="xx" to force one language (skips the lock); allowed=()
    disables the lock. Returns ("", "") on any failure."""
    if not wav_bytes:
        return "", ""
    model = _get_model(size, device, compute_type)
    if model is None:
        return "", ""
    try:
        text, lang = _run(model, wav_bytes, language)
        if language is None and allowed and lang not in allowed:
            if lang:                       # a real, disallowed language -> redo in en
                text, _ = _run(model, wav_bytes, allowed[0])
            lang = allowed[0]              # unknown ("") just gets the default label
        return text, lang
    except Exception as e:
        print(f"[STT] transcribe failed: {e}")
        return "", ""
