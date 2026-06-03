from brain.events import (
    PerceptionEvent, SALIENT_TYPES,
    PERSON_DETECTED, FACE_RECOGNIZED, SONAR, is_salient,
)


def test_event_holds_type_and_data():
    e = PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=1.0)
    assert e.type == FACE_RECOGNIZED
    assert e.data["face_id"] == "alice"
    assert e.ts == 1.0


def test_salient_classification():
    assert is_salient(PerceptionEvent(PERSON_DETECTED, {}))
    assert is_salient(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "x"}))
    assert not is_salient(PerceptionEvent(SONAR, {"front": 0.6}))
    assert SONAR not in SALIENT_TYPES
