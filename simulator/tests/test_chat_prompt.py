import datetime

from sim_bridge import build_system_prompt


SAMPLE = {
    "battery": 88.0,
    "charging": False,
    "posture": "Stand",
    "is_moving": False,
    "eye_color": {"r": 0, "g": 255, "b": 0},
}


def test_grounds_current_date_and_state():
    s = build_system_prompt(SAMPLE, datetime.datetime(2026, 6, 3, 14, 30))
    assert "Wednesday, 03 June 2026, 14:30" in s   # the fix for invented dates
    assert "88" in s and "Stand" in s and "rgb(0,255,0)" in s


def test_persona_constrains_for_tts_and_scope():
    s = build_system_prompt(SAMPLE, datetime.datetime.now())
    assert "Pepper" in s
    assert "no markdown" in s.lower()              # spoken aloud → no markup
    assert "cannot pick up or manipulate" in s.lower()  # HRI scope boundary


def test_partial_state_does_not_crash():
    s = build_system_prompt({}, datetime.datetime(2026, 6, 3, 14, 30))
    assert "Pepper" in s and "2026" in s
