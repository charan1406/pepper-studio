"""Builds the grounded system prompt: Pepper's HRI persona + the current
engagement state + what we remember about the person in front of us. The LLM
decides what to do by calling tools; this tells it who/where it is."""

_PERSONA = (
    "You are Pepper, a friendly social robot. You greet and converse with people "
    "warmly and briefly. You act ONLY by calling the provided tools (say, look_at, "
    "set_posture, set_leds, run_animation) — never narrate. Keep spoken lines to one "
    "or two short sentences."
)


def build_system_prompt(state: str, partner, person) -> str:
    lines = [_PERSONA, f"\nCurrent engagement state: {state}."]
    if person:
        name = person.get("name", partner)
        notes = person.get("notes", "")
        lines.append(f"The person in front of you is {name}, whom you've met before."
                     + (f" What you remember: {notes}." if notes else ""))
    else:
        lines.append("You haven't met this person before — this is a new face.")
    return "\n".join(lines)
