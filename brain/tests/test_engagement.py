from brain.engagement import EngagementState, IDLE, ENGAGING, CONVERSING, FAREWELL
from brain.events import PerceptionEvent, FACE_RECOGNIZED, SPEECH_HEARD, PERSON_LEFT, SONAR


def test_first_face_wakes_llm_and_engages():
    eng = EngagementState()
    d = eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    assert d.wake_llm is True
    assert eng.state == ENGAGING
    assert eng.partner == "alice"


def test_repeat_face_within_debounce_is_suppressed():
    eng = EngagementState(debounce_s=60)
    eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    d = eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=5), now=5)
    assert d.wake_llm is False


def test_speech_while_conversing_wakes_llm():
    eng = EngagementState()
    eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    d = eng.consider(PerceptionEvent(SPEECH_HEARD, {"text": "hi"}, ts=1), now=1)
    assert d.wake_llm is True
    assert eng.state == CONVERSING


def test_telemetry_never_wakes_llm():
    eng = EngagementState()
    d = eng.consider(PerceptionEvent(SONAR, {"front": 0.6}, ts=0), now=0)
    assert d.wake_llm is False
    assert eng.state == IDLE


def test_person_left_goes_to_farewell():
    eng = EngagementState()
    eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    d = eng.consider(PerceptionEvent(PERSON_LEFT, {}, ts=2), now=2)
    assert eng.state == FAREWELL
    assert d.wake_llm is True


def test_idle_timeout_resets():
    eng = EngagementState(idle_timeout_s=30)
    eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    assert eng.maybe_timeout(now=40) is True
    assert eng.state == IDLE
    assert eng.partner is None


def test_telemetry_does_not_reset_idle_timeout():
    eng = EngagementState(idle_timeout_s=30)
    eng.consider(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    # telemetry at t=20 must NOT push the idle clock forward
    eng.consider(PerceptionEvent(SONAR, {"front": 0.6}, ts=20), now=20)
    assert eng.maybe_timeout(now=35) is True  # 35s since last SALIENT event (t=0)
