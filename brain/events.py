"""Perception event schema — the portable contract between any robot's
perception and the brain. Source-agnostic: a MockEventSource produces these
today; a NAOqi WS source produces identical events later."""
from dataclasses import dataclass, field

# Salient = can wake the LLM. Telemetry = updates state only.
PERSON_DETECTED = "person_detected"
PERSON_LEFT = "person_left"
FACE_RECOGNIZED = "face_recognized"
SPEECH_HEARD = "speech_heard"
TOUCHED = "touched"
SONAR = "sonar"
BATTERY = "battery"

SALIENT_TYPES = {PERSON_DETECTED, PERSON_LEFT, FACE_RECOGNIZED, SPEECH_HEARD, TOUCHED}


@dataclass
class PerceptionEvent:
    type: str
    data: dict = field(default_factory=dict)
    ts: float = 0.0


def is_salient(event: "PerceptionEvent") -> bool:
    return event.type in SALIENT_TYPES
