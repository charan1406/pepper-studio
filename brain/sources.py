"""Event sources. MockEventSource feeds scripted events for dev/tests; the real
BridgeWSEventSource (NAOqi events over the bridge WS) is a later sub-project."""
import time
from .events import (
    PerceptionEvent, FACE_RECOGNIZED, SPEECH_HEARD, PERSON_LEFT,
)


class MockEventSource:
    def __init__(self, events, delay_s=0.0):
        self._events = list(events)
        self._delay = delay_s

    def events(self):
        for e in self._events:
            if self._delay:
                time.sleep(self._delay)
            yield e


def demo_script():
    """A greet → converse → leave sequence for the live smoke run."""
    return [
        PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=time.time()),
        PerceptionEvent(SPEECH_HEARD, {"text": "Hello Pepper, how are you?"}, ts=time.time() + 2),
        PerceptionEvent(SPEECH_HEARD, {"text": "Tell me a joke."}, ts=time.time() + 5),
        PerceptionEvent(PERSON_LEFT, {}, ts=time.time() + 9),
    ]
