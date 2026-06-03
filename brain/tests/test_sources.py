from brain.sources import MockEventSource, demo_script
from brain.events import PerceptionEvent, FACE_RECOGNIZED


def test_mock_source_yields_given_events():
    evs = [PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0)]
    assert list(MockEventSource(evs).events()) == evs


def test_demo_script_is_a_greet_converse_leave_sequence():
    types = [e.type for e in demo_script()]
    assert types[0] == FACE_RECOGNIZED
    assert "speech_heard" in types
    assert types[-1] == "person_left"
