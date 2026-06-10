"""Optional 'play a song' tool — fetch audio from YouTube and play it through
Pepper's speakers via the bridge's /audio/play.

Needs yt-dlp + ffmpeg on PATH. Optional and graceful: if they're missing, the
tool isn't offered (see agent.py) and play_song() returns a spoken apology.
Spawned as an args-as-list subprocess, never shell=True (no injection from the
LLM-supplied query).
"""
import glob
import os
import shutil
import subprocess

HAS_YTDLP = shutil.which("yt-dlp") is not None and shutil.which("ffmpeg") is not None

PLAY_SONG_TOOL = {
    "type": "function",
    "function": {
        "name": "play_song",
        "description": (
            "Search YouTube for a song and play it through the robot's speakers. "
            "Use when the person asks you to play music or a specific song/artist."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "song title and/or artist to search for",
                },
            },
            "required": ["query"],
        },
    },
}

STOP_AUDIO_TOOL = {
    "type": "function",
    "function": {
        "name": "stop_audio",
        "description": "Stop the music or audio that is currently playing.",
        "parameters": {"type": "object", "properties": {}},
    },
}

MUSIC_TOOLS = [PLAY_SONG_TOOL, STOP_AUDIO_TOOL]
MUSIC_NAMES = {"play_song", "stop_audio"}

_OUT = "/tmp/pepper_song.wav"


def play_song(client, query, timeout=90):
    """Download the first YouTube hit for `query` as mono WAV and play it.
    Returns a short spoken confirmation."""
    if not HAS_YTDLP:
        return "Sorry, music isn't set up — I need yt-dlp and ffmpeg installed."
    for f in glob.glob("/tmp/pepper_song*"):
        try:
            os.remove(f)
        except OSError:
            pass
    cmd = [
        "yt-dlp", "--no-playlist", "--quiet",
        # skip 24/7 livestreams (never finish downloading) and overly long videos
        "--match-filter", "!is_live & duration < 900",
        "-x", "--audio-format", "wav",
        "--postprocessor-args", "ffmpeg:-ac 1 -ar 22050",
        "-o", "/tmp/pepper_song.%(ext)s",
        f"ytsearch5:{query}",
        "--max-downloads", "1",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return "Sorry, that took too long to find."
    # --max-downloads makes yt-dlp exit non-zero after a successful download, so
    # judge success by whether the WAV exists, not by the return code.
    if not os.path.exists(_OUT):
        tail = (proc.stderr or b"")[-300:].decode("utf-8", "replace")
        print(f"[music] no audio produced: {tail}")
        return "Sorry, I couldn't find that song."
    with open(_OUT, "rb") as f:
        wav = f.read()
    ok = client.play_audio(wav)
    return "Sure, playing that now." if ok else "I found it but couldn't play it."


def stop_audio(client):
    client.stop_audio()
    return "Okay, stopping the music."
