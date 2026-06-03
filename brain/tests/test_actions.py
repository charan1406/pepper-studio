from brain.actions import ActionExecutor, TOOL_SCHEMAS


class FakeClient:
    def __init__(self):
        self.calls = []
    def speak(self, text, language="en"): self.calls.append(("speak", text)); return True
    def set_head(self, yaw=0, pitch=0, speed=0.2): self.calls.append(("set_head", yaw, pitch)); return True
    def set_posture(self, posture, speed=0.5): self.calls.append(("set_posture", posture)); return True
    def set_eye_color(self, r, g, b): self.calls.append(("set_eye_color", r, g, b)); return True
    def run_animation(self, name): self.calls.append(("run_animation", name)); return True


def test_tool_schemas_cover_the_toolset():
    names = {t["function"]["name"] for t in TOOL_SCHEMAS}
    assert names == {"say", "look_at", "set_posture", "set_leds", "run_animation"}


def test_say_calls_client_speak():
    c = FakeClient()
    ok, _ = ActionExecutor(c).execute("say", {"text": "hello"})
    assert ok is True
    assert c.calls == [("speak", "hello")]


def test_set_leds_maps_to_eye_color():
    c = FakeClient()
    ActionExecutor(c).execute("set_leds", {"r": 0, "g": 0, "b": 255})
    assert c.calls == [("set_eye_color", 0, 0, 255)]


def test_unknown_tool_is_soft_failure():
    c = FakeClient()
    ok, detail = ActionExecutor(c).execute("teleport", {})
    assert ok is False
    assert "unknown" in detail.lower()
    assert c.calls == []


def test_client_exception_is_caught():
    class Boom:
        def speak(self, *a, **k): raise RuntimeError("bridge down")
    ok, detail = ActionExecutor(Boom()).execute("say", {"text": "hi"})
    assert ok is False
    assert "bridge down" in detail
