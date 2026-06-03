"""Engagement lifecycle + the gate that decides which events wake the LLM.
Keeps the brain cheap (salient events only, debounced) and sane (one partner,
no re-greeting, no talking to nobody)."""
from dataclasses import dataclass
from .events import (
    is_salient, FACE_RECOGNIZED, PERSON_DETECTED, PERSON_LEFT, SPEECH_HEARD, TOUCHED,
)

IDLE = "IDLE"
ENGAGING = "ENGAGING"
CONVERSING = "CONVERSING"
FAREWELL = "FAREWELL"


@dataclass
class EngagementDecision:
    wake_llm: bool
    note: str = ""


class EngagementState:
    def __init__(self, debounce_s: float = 60.0, idle_timeout_s: float = 30.0):
        self.debounce_s = debounce_s
        self.idle_timeout_s = idle_timeout_s
        self.state = IDLE
        self.partner = None
        self._last_greeted = {}      # face_id -> ts
        self._last_event_ts = 0.0

    def consider(self, event, now: float) -> EngagementDecision:
        if not is_salient(event):
            return EngagementDecision(False, "telemetry")
        self._last_event_ts = now

        if event.type == PERSON_LEFT:
            if self.state in (ENGAGING, CONVERSING):
                self.state = FAREWELL
                return EngagementDecision(True, "farewell")
            return EngagementDecision(False, "left while not engaged")

        if event.type in (FACE_RECOGNIZED, PERSON_DETECTED):
            # NOTE (slice 2): PERSON_DETECTED with no face_id debounces on None,
            # so distinct unknown visitors share one bucket. Fine for mock events;
            # revisit when wiring real perception (key only FACE_RECOGNIZED, or use
            # an ephemeral per-detection id).
            face_id = event.data.get("face_id")
            last = self._last_greeted.get(face_id)
            if last is not None and (now - last) < self.debounce_s:
                return EngagementDecision(False, "debounced")
            self._last_greeted[face_id] = now
            self.partner = face_id
            self.state = ENGAGING
            return EngagementDecision(True, "greet")

        if event.type in (SPEECH_HEARD, TOUCHED):
            if self.state in (ENGAGING, CONVERSING):
                self.state = CONVERSING
                return EngagementDecision(True, "respond")
            return EngagementDecision(False, "no partner")

        return EngagementDecision(False, "unhandled")

    def maybe_timeout(self, now: float) -> bool:
        if self.state in (ENGAGING, CONVERSING, FAREWELL) and \
                (now - self._last_event_ts) >= self.idle_timeout_s:
            self.reset()
            return True
        return False

    def reset(self):
        self.state = IDLE
        self.partner = None
