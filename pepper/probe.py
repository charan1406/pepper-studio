# -*- coding: utf-8 -*-
"""
Pepper ground-truth probe  (Python 2.7, run ON the robot).

READ-ONLY. No motion. Safe to run unattended. Enumerates services, joints +
limits + current angles, valid postures, animations, TTS voices/languages,
LED groups, autonomous-life state, camera format, and sensor/ALMemory keys —
everything we need to build the real-robot side of Studio without the robot
in front of us. Prints to the terminal AND writes pepper_probe_report.txt.

Usage:  python probe.py [--ip 127.0.0.1] [--port 9559]
Then send back the printed output (or scp pepper_probe_report.txt).
"""
from __future__ import print_function
import sys
import time

IP, PORT = "127.0.0.1", 9559
_a = sys.argv[1:]
if "--ip" in _a:
    IP = _a[_a.index("--ip") + 1]
if "--port" in _a:
    PORT = int(_a[_a.index("--port") + 1])

try:
    from naoqi import ALProxy
except ImportError:
    print("[FATAL] naoqi not found — run this ON the robot with Python 2.7.")
    sys.exit(1)

REPORT = "pepper_probe_report.txt"
_f = open(REPORT, "w")


def out(*a):
    line = " ".join(str(x) for x in a)
    print(line)
    try:
        _f.write(line + "\n")
        _f.flush()
    except Exception:
        pass


def section(t):
    out("")
    out("=" * 66)
    out("  " + t)
    out("=" * 66)


def short(r, n=4000):
    s = repr(r)
    return s if len(s) <= n else s[:n] + " ...(truncated; full in file)"


def px(name):
    try:
        return ALProxy(name, IP, PORT)
    except Exception as e:
        out("  [!] proxy %s failed: %s" % (name, e))
        return None


def call(label, fn):
    try:
        r = fn()
        out("  %-30s = %s" % (label, short(r)))
        return r
    except Exception as e:
        out("  %-30s ! %s" % (label, e))
        return None


def run_section(title, fn):
    section(title)
    try:
        fn()
    except Exception as e:
        out("  [section error] %s" % e)


# ─── sections ────────────────────────────────────────────────────

def sec_env():
    s = px("ALSystem")
    if s:
        call("ALSystem.systemVersion", s.systemVersion)
        call("ALSystem.robotName", s.robotName)
    m = px("ALMotion")
    if m:
        call("ALMotion.robotIsWakeUp", m.robotIsWakeUp)
        cfg = call("ALMotion.getRobotConfig", m.getRobotConfig)
        try:
            for k, v in zip(cfg[0], cfg[1]):
                out("      cfg %-26s = %s" % (k, v))
        except Exception:
            pass
    b = px("ALBattery")
    if b:
        call("ALBattery.getBatteryCharge", b.getBatteryCharge)
    mem = px("ALMemory")
    if mem:
        call("battery charging power",
             lambda: mem.getData("Device/SubDeviceList/Battery/Charge/Sensor/Power"))


def sec_services():
    try:
        import qi
        sess = qi.Session()
        sess.connect("tcp://%s:%d" % (IP, PORT))
        svcs = sess.services()
        names = []
        for s in svcs:
            try:
                names.append(s["name"])
            except Exception:
                try:
                    names.append(s.name)
                except Exception:
                    names.append(str(s))
        out("  %d services registered:" % len(names))
        for n in sorted(names):
            out("    " + n)
    except Exception as e:
        out("  [!] qi service enumeration failed: %s" % e)


def sec_bridge_services():
    used = ["ALTextToSpeech", "ALMotion", "ALRobotPosture", "ALVideoDevice",
            "ALAudioDevice", "ALAudioPlayer", "ALLeds", "ALAnimationPlayer",
            "ALTabletService", "ALFaceDetection", "ALTracker", "ALAutonomousLife",
            "ALBasicAwareness", "ALBattery", "ALMemory", "ALNavigation"]
    for s in used:
        try:
            ALProxy(s, IP, PORT)
            out("  %-22s present" % s)
        except Exception as e:
            out("  %-22s ABSENT/err: %s" % (s, e))


def sec_postures():
    p = px("ALRobotPosture")
    if not p:
        return
    call("getPostureList", p.getPostureList)
    call("getPosture", p.getPosture)
    call("getPostureFamily", p.getPostureFamily)


def sec_joints():
    m = px("ALMotion")
    if not m:
        return
    names = call("getBodyNames('Body')", lambda: m.getBodyNames("Body"))
    angles, stiff = None, None
    try:
        angles = m.getAngles("Body", True)
    except Exception as e:
        out("  getAngles ! %s" % e)
    try:
        stiff = m.getStiffnesses("Body")
    except Exception:
        pass
    out("  per-joint  getLimits=[min,max,maxVel,maxTorque] | current angle | stiffness")
    if names:
        for i, jn in enumerate(names):
            try:
                lim = m.getLimits(jn)
            except Exception as e:
                lim = "ERR:%s" % e
            a = angles[i] if angles and i < len(angles) else "?"
            st = stiff[i] if stiff and i < len(stiff) else "?"
            out("    %-22s %s  ang=%s stiff=%s" % (jn, lim, a, st))
    call("getRobotPosition(True)", lambda: m.getRobotPosition(True))


def sec_tts():
    t = px("ALTextToSpeech")
    if not t:
        return
    call("getLanguage", t.getLanguage)
    call("getAvailableLanguages", t.getAvailableLanguages)
    call("getAvailableVoices", t.getAvailableVoices)
    call("getVolume", t.getVolume)


def sec_anim():
    a = px("ALAnimationPlayer")
    if not a:
        return
    call("getAnimationsList", a.getAnimationsList)
    try:
        call("getTagList", a.getTagList)
    except Exception:
        pass


def sec_leds():
    l = px("ALLeds")
    if not l:
        return
    call("listGroups", l.listGroups)
    call("listLEDs", l.listLEDs)


def sec_audio():
    a = px("ALAudioDevice")
    if not a:
        return
    call("getOutputVolume", a.getOutputVolume)


def sec_auto():
    a = px("ALAutonomousLife")
    if a:
        call("ALAutonomousLife.getState", a.getState)
    aw = px("ALBasicAwareness")
    if aw:
        call("ALBasicAwareness.isEnabled", aw.isEnabled)


def sec_nav():
    n = px("ALNavigation")
    if not n:
        return
    call("getRobotPositionInMap", n.getRobotPositionInMap)


def sec_video():
    v = px("ALVideoDevice")
    if not v:
        return
    sub = None
    try:
        sub = v.subscribeCamera("probe_%d" % int(time.time()), 0, 2, 11, 5)  # top, 640x480, RGB, 5fps
        img = v.getImageRemote(sub)
        if img:
            nbytes = len(img[6]) if len(img) > 6 and img[6] else 0
            out("  top camera: width=%s height=%s layers=%s colorspace=%s "
                "ts=%s.%s bytes=%s" % (img[0], img[1], img[2], img[3], img[4], img[5], nbytes))
        else:
            out("  getImageRemote returned None (camera busy or warming up)")
    except Exception as e:
        out("  video ! %s" % e)
    finally:
        if sub:
            try:
                v.unsubscribe(sub)
            except Exception:
                pass


def sec_sensors():
    mem = px("ALMemory")
    if not mem:
        return
    keys = [
        "Device/SubDeviceList/Platform/Front/Sonar/Sensor/Value",
        "Device/SubDeviceList/Platform/Back/Sonar/Sensor/Value",
        "Device/SubDeviceList/Platform/FrontLeft/Bumper/Sensor/Value",
        "Device/SubDeviceList/Platform/FrontRight/Bumper/Sensor/Value",
        "Device/SubDeviceList/Platform/Back/Bumper/Sensor/Value",
        "Device/SubDeviceList/Head/Touch/Front/Sensor/Value",
        "Device/SubDeviceList/Head/Touch/Middle/Sensor/Value",
        "Device/SubDeviceList/Head/Touch/Rear/Sensor/Value",
        "Device/SubDeviceList/LHand/Touch/Back/Sensor/Value",
        "Device/SubDeviceList/RHand/Touch/Back/Sensor/Value",
        "FaceDetected",
    ]
    for k in keys:
        call(k, lambda k=k: mem.getData(k))
    try:
        all_keys = sorted(mem.getDataListName())
        out("  total ALMemory keys: %d (full list written to %s only)" % (len(all_keys), REPORT))
        _f.write("\n--- FULL ALMemory key list (%d) ---\n" % len(all_keys))
        for k in all_keys:
            _f.write(k + "\n")
        _f.flush()
        interest = [k for k in all_keys if any(w in k for w in
                    ("Sonar", "Bumper", "Touch", "Laser", "Temperature", "Current/Sensor"))]
        out("  sensor-ish keys (%d, first 150 shown):" % len(interest))
        for k in interest[:150]:
            out("    " + k)
    except Exception as e:
        out("  getDataListName ! %s" % e)


# ─── main ────────────────────────────────────────────────────────

out("PEPPER PROBE  ip=%s port=%d  %s" % (IP, PORT, time.strftime("%Y-%m-%d %H:%M:%S")))
run_section("ENVIRONMENT / VERSION / BATTERY", sec_env)
run_section("SERVICES (qi enumeration — everything the robot exposes)", sec_services)
run_section("BRIDGE SERVICES PRESENCE (what the current endpoints rely on)", sec_bridge_services)
run_section("POSTURES (valid names for THIS robot)", sec_postures)
run_section("JOINTS + LIMITS + CURRENT ANGLES", sec_joints)
run_section("TTS LANGUAGES / VOICES / VOLUME", sec_tts)
run_section("ANIMATIONS (installed list)", sec_anim)
run_section("LED GROUPS", sec_leds)
run_section("AUDIO", sec_audio)
run_section("AUTONOMOUS LIFE / AWARENESS", sec_auto)
run_section("NAVIGATION", sec_nav)
run_section("CAMERA (top frame metadata)", sec_video)
run_section("SENSORS / ALMemory KEYS (for SP2 telemetry + safety)", sec_sensors)
out("")
out("DONE. Full report saved to: %s" % REPORT)
_f.close()
