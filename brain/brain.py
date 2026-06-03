"""The sense → think → act loop. All collaborators are injected so it runs
against mocks (tests) or the real SimLLMClient + PepperClient (__main__).
Fail-soft: any boundary failure degrades one turn and is logged, never crashes."""
import logging
from .engagement import FAREWELL
from .events import FACE_RECOGNIZED, PERSON_DETECTED, SPEECH_HEARD
from .persona import build_system_prompt
from .actions import TOOL_SCHEMAS

log = logging.getLogger("brain")


class Brain:
    def __init__(self, llm, executor, memory, engagement, tools=None):
        self.llm = llm
        self.executor = executor
        self.memory = memory
        self.engagement = engagement
        self.tools = tools if tools is not None else TOOL_SCHEMAS
        self._history = []          # conversation turns for the current engagement
        self._transcript = []       # plain text, for end-of-encounter summary

    def handle(self, event, now) -> list:
        decision = self.engagement.consider(event, now)
        if not decision.wake_llm:
            return []

        partner = self.engagement.partner
        person = self.memory.get(partner) if partner else None
        system = build_system_prompt(self.engagement.state, partner, person)

        if event.type == SPEECH_HEARD:
            self._history.append({"role": "user", "content": event.data.get("text", "")})
            self._transcript.append("Person: " + event.data.get("text", ""))

        messages = [{"role": "system", "content": system}] + self._history
        if event.type in (FACE_RECOGNIZED, PERSON_DETECTED):
            messages.append({"role": "user",
                             "content": "[a person is now in front of you]"})

        result = self._safe_llm(messages)
        if result is None or not getattr(result, "tool_calls", None):
            self._maybe_finish(now)
            return []

        outcomes = []
        for call in result.tool_calls:
            outcomes.append(self.executor.execute(call["name"], call.get("args", {})))
            if call["name"] == "say":
                said = call.get("args", {}).get("text", "")
                self._history.append({"role": "assistant", "content": said})
                self._transcript.append("You: " + said)

        self._maybe_finish(now)
        return outcomes

    def _maybe_finish(self, now):
        if self.engagement.state == FAREWELL:
            self._summarize_and_store()
            self.engagement.reset()
            self._history = []
            self._transcript = []

    def _summarize_and_store(self):
        partner = self.engagement.partner
        if not partner or not self._transcript:
            return
        try:
            r = self.llm.chat(
                "Summarize what you learned about this person in one short sentence:\n"
                + "\n".join(self._transcript),
                system="You write one-sentence memory notes.",
            )
            if getattr(r, "success", False) and r.content:
                self.memory.upsert(partner, notes=r.content.strip())
        except Exception as e:  # keep prior note on failure
            log.warning("summary failed: %s", e)

    def _safe_llm(self, messages):
        try:
            return self.llm.chat_tools(messages, self.tools)
        except Exception as e:
            log.warning("llm call failed: %s", e)
            return None

    def run(self, source):
        """Consume events from an EventSource until exhausted."""
        import time
        for event in source.events():
            self.handle(event, event.ts or time.time())
