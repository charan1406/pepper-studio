from brain.brain import Brain
from brain.engagement import EngagementState
from brain.memory import PeopleMemory
from brain.actions import ActionExecutor
from brain.events import PerceptionEvent, FACE_RECOGNIZED, SPEECH_HEARD, PERSON_LEFT


class FakeClient:
    def __init__(self): self.calls = []
    def speak(self, text, language="en"): self.calls.append(("speak", text)); return True
    def set_head(self, yaw=0, pitch=0, speed=0.2): self.calls.append(("set_head",)); return True
    def set_posture(self, posture, speed=0.5): self.calls.append(("set_posture", posture)); return True
    def set_eye_color(self, r, g, b): self.calls.append(("leds",)); return True
    def run_animation(self, name): self.calls.append(("anim", name)); return True


class Result:
    def __init__(self, tool_calls): self.success = True; self.content = ""; self.tool_calls = tool_calls


class ScriptedLLM:
    """Returns queued tool-call sets; records the messages it was called with."""
    def __init__(self, script):
        self.script = list(script)
        self.seen_prompts = []
    def chat_tools(self, messages, tools):
        self.seen_prompts.append(messages)
        calls = self.script.pop(0) if self.script else []
        return Result(calls)


def _brain(tmp_path, script):
    client = FakeClient()
    llm = ScriptedLLM(script)
    b = Brain(
        llm=llm,
        executor=ActionExecutor(client),
        memory=PeopleMemory(str(tmp_path / "people.json")),
        engagement=EngagementState(debounce_s=60),
    )
    return b, client, llm


def test_known_person_greeting_uses_memory_and_speaks(tmp_path):
    b, client, llm = _brain(tmp_path, script=[[{"name": "say", "args": {"text": "Hi Alice!"}}]])
    b.memory.upsert("alice", name="Alice", notes="likes jazz")
    b.handle(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    assert ("speak", "Hi Alice!") in client.calls
    flat = str(llm.seen_prompts[-1])
    assert "Alice" in flat and "likes jazz" in flat


def test_repeat_face_in_debounce_does_not_speak_twice(tmp_path):
    b, client, llm = _brain(tmp_path, script=[
        [{"name": "say", "args": {"text": "Hi!"}}],
        [{"name": "say", "args": {"text": "Hi again!"}}],
    ])
    b.handle(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    b.handle(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=5), now=5)
    assert [c for c in client.calls if c[0] == "speak"] == [("speak", "Hi!")]


def test_person_left_writes_a_memory_note(tmp_path):
    class SummaryLLM(ScriptedLLM):
        def chat_tools(self, messages, tools):
            self.seen_prompts.append(messages)
            return Result([{"name": "say", "args": {"text": "Bye!"}}])
        def chat(self, message, system=None, history=None):
            class R: success = True; content = "Talked about jazz."
            return R()
    b, client, _ = _brain(tmp_path, script=[])
    b.llm = SummaryLLM([])
    b.handle(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "alice"}, ts=0), now=0)
    b.handle(PerceptionEvent(PERSON_LEFT, {}, ts=2), now=2)
    rec = b.memory.get("alice")
    assert rec is not None and "jazz" in rec.get("notes", "")


def test_llm_failure_does_not_crash(tmp_path):
    class BoomLLM:
        def chat_tools(self, messages, tools): raise RuntimeError("llm down")
    b, client, _ = _brain(tmp_path, script=[])
    b.llm = BoomLLM()
    out = b.handle(PerceptionEvent(FACE_RECOGNIZED, {"face_id": "x"}, ts=0), now=0)
    assert out == []  # no actions, no exception
