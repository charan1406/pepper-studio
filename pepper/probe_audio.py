# -*- coding: utf-8 -*-
"""On-robot audio probe (Python 2.7 / NAOqi) — run THIS on the Pepper.

Answers the two questions the service-enumeration probe couldn't:
  1. Does the mic actually record usable audio? (gates the whole voice loop input)
  2. Does ALAudioPlayer.playWebStream() exist AND decode an HTTP MP3 stream?
     (gates real-time music: Option B = laptop transcode proxy -> playWebStream)

It talks to NAOqi DIRECTLY via ALProxy — no bridge involved — so it isolates
"can the hardware do this" from "is the bridge wired right". If a primitive
works here, the only thing left is to expose it as an endpoint.

Copy to the robot and run:
    python2 probe_audio.py                       # localhost, default SomaFM MP3
    python2 probe_audio.py --ip 127.0.0.1 --port 9559
    python2 probe_audio.py --url http://<laptop-ip>:PORT/stream.mp3   # test the LAN proxy path
    python2 probe_audio.py --secs 12

Nothing here moves the robot. It records 3s of mic and plays ~10s of audio.
"""
import argparse
import time
import wave

try:
    from naoqi import ALProxy
except ImportError:
    print("[fatal] no naoqi module — run this ON the robot (python2), not the laptop")
    raise SystemExit(1)

# A long-lived, reliably MP3-over-HTTP internet-radio stream. If playWebStream
# can chew on this, it can chew on the laptop transcode proxy's MP3 output too.
DEFAULT_URL = "http://ice1.somafm.com/groovesalad-128-mp3"
REC_RAW = "/tmp/probe_mic.wav"


def line():
    print("=" * 66)


def section(title):
    print("")
    line()
    print("  " + title)
    line()


def probe_methods(player):
    """List ALAudioPlayer methods and flag the streaming ones we care about."""
    section("ALAudioPlayer METHODS (does streaming exist on THIS firmware?)")
    wanted = ["playWebStream", "playStream", "playFile",
              "playFileFromPosition", "stopAll", "setVolume"]
    try:
        methods = player.getMethodList()
    except Exception as e:
        print("  getMethodList failed: %s" % e)
        print("  (falling back to blind calls below)")
        methods = []
    for name in wanted:
        present = name in methods if methods else "?"
        print("  %-22s = %s" % (name, "present" if present is True
                                 else ("MISSING" if present is False else "?")))
    return methods


def probe_mic(ip, port, secs=3):
    """Record from the mic and report what NAOqi actually produced."""
    section("MIC RECORD (the voice loop's only input path)")
    try:
        device = ALProxy("ALAudioDevice", ip, port)
    except Exception as e:
        print("  ALAudioDevice proxy failed: %s" % e)
        return
    try:
        print("  recording %ds ... (say something)" % secs)
        device.startMicrophonesRecording(REC_RAW)
        time.sleep(secs)
        device.stopMicrophonesRecording()
    except Exception as e:
        print("  recording FAILED: %s" % e)
        return
    try:
        wf = wave.open(REC_RAW, "rb")
        ch, rate, width = wf.getnchannels(), wf.getframerate(), wf.getsampwidth()
        frames = wf.getnframes()
        wf.close()
        import os
        size = os.path.getsize(REC_RAW)
        print("  OK -> %s" % REC_RAW)
        print("  channels=%d  rate=%dHz  width=%dB  frames=%d  size=%dKB"
              % (ch, rate, width, frames, size // 1024))
        if size < 4000:
            print("  [WARN] file is tiny — mic may be muted or returned silence")
        if ch != 1:
            print("  note: %d channels -> bridge's _extract_mono pulls channel 0" % ch)
    except Exception as e:
        print("  produced a file but couldn't parse it as WAV: %s" % e)


def probe_stream(player, url, secs):
    """The headline test: stream an HTTP MP3 directly on the robot."""
    section("playWebStream (real-time music feasibility)")
    print("  url : %s" % url)
    print("  playing %ds then stopping ..." % secs)
    try:
        # signature: playWebStream(url, volume, pan). post.* so we control the
        # duration ourselves and stop cleanly rather than blocking the whole track.
        task = player.post.playWebStream(url, 1.0, 0.0)
        time.sleep(secs)
        player.stopAll()
        print("  RESULT: no exception — playWebStream is SUPPORTED.")
        print("          (confirm with your EARS: did music actually come out?)")
        print("          task id was %s" % task)
        print("  => Option B is GO: build laptop MP3 proxy + /audio/play/url endpoint")
    except Exception as e:
        msg = str(e)
        print("  RESULT: playWebStream raised -> %s" % msg)
        if "find method" in msg or "method" in msg.lower():
            print("  => method MISSING on this firmware. No native streaming.")
            print("     Stuck with download-then-play; only speedup is lower bitrate.")
        else:
            print("  => method exists but this stream failed (codec? robot internet?).")
            print("     Retry with --url pointing at a known-good MP3, or a LAN proxy.")


def main():
    ap = argparse.ArgumentParser(description="On-robot Pepper audio probe")
    ap.add_argument("--ip", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=9559)
    ap.add_argument("--url", default=DEFAULT_URL, help="HTTP MP3 stream to test")
    ap.add_argument("--secs", type=int, default=10, help="seconds to stream")
    ap.add_argument("--rec-secs", type=int, default=3, help="seconds to record")
    ap.add_argument("--skip-mic", action="store_true")
    ap.add_argument("--skip-stream", action="store_true")
    args = ap.parse_args()

    print("PEPPER AUDIO PROBE  ip=%s port=%d  %s"
          % (args.ip, args.port, time.strftime("%Y-%m-%d %H:%M:%S")))

    try:
        player = ALProxy("ALAudioPlayer", args.ip, args.port)
    except Exception as e:
        print("[fatal] can't reach ALAudioPlayer at %s:%d -> %s"
              % (args.ip, args.port, e))
        raise SystemExit(1)

    try:
        player.setOutputVolume(70)
    except Exception:
        pass

    probe_methods(player)
    if not args.skip_mic:
        probe_mic(args.ip, args.port, args.rec_secs)
    if not args.skip_stream:
        probe_stream(player, args.url, args.secs)

    section("DONE")
    print("  Trust your ears over the 'no exception' line — NAOqi can accept a")
    print("  call and silently play nothing if the codec/URL isn't digestible.")


if __name__ == "__main__":
    main()
