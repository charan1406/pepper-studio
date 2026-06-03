from brain.persona import build_system_prompt


def test_prompt_includes_state_and_known_person():
    p = build_system_prompt(state="ENGAGING", partner="alice",
                            person={"name": "Alice", "notes": "likes jazz"})
    assert "ENGAGING" in p
    assert "Alice" in p
    assert "likes jazz" in p


def test_prompt_handles_unknown_person():
    p = build_system_prompt(state="ENGAGING", partner=None, person=None)
    assert "ENGAGING" in p
    assert "haven't met" in p.lower() or "new" in p.lower()
