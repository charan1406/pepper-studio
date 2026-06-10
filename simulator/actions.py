"""Robot-action tools for the AI brain.

The LLM can drive Pepper by emitting these tool calls (same tool-calling path as
web_search). The executor maps each call to the existing bridge client methods
and **clamps every value** so the model can't send the robot flying — locomotion
is bounded, and NAOqi's External Collision Protection (on by default) stops
forward drive near obstacles/people.
"""
import math

MAX_DISTANCE_M = 0.5    # never drive more than half a metre per command
MAX_TURN_DEG = 90       # never spin more than a quarter turn per command

ACTION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "move",
            "description": (
                "Drive the robot a short distance forward or backward. Use when the "
                "person asks you to come closer, back up, or move."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["forward", "backward"]},
                    "distance_m": {
                        "type": "number",
                        "description": "distance in metres, 0.1 to 0.5",
                    },
                },
                "required": ["direction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "turn",
            "description": (
                "Rotate the robot in place to the left or right. Use when asked to "
                "turn, spin, or face a different direction."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["left", "right"]},
                    "angle_deg": {
                        "type": "number",
                        "description": "rotation in degrees, 15 to 90",
                    },
                },
                "required": ["direction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "wave",
            "description": "Wave hello with the robot's hand — a friendly greeting gesture.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

ACTION_NAMES = {t["function"]["name"] for t in ACTION_TOOLS}


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def execute(client, name, args):
    """Run a robot action via the bridge client. Returns a short spoken
    confirmation, or None if the name isn't an action."""
    try:
        if name == "move":
            direction = args.get("direction", "forward")
            dist = _clamp(float(args.get("distance_m") or 0.3), 0.1, MAX_DISTANCE_M)
            x = dist if direction == "forward" else -dist
            client.move_to(x, 0, 0)
            return f"Okay, moving {direction}."
        if name == "turn":
            direction = args.get("direction", "left")
            deg = _clamp(float(args.get("angle_deg") or 45), 15, MAX_TURN_DEG)
            theta = math.radians(deg) * (1 if direction == "left" else -1)
            client.move_to(0, 0, theta)
            return f"Turning {direction}."
        if name == "wave":
            client.wave()
            return "Hello there!"
    except Exception as e:
        print(f"[action] {name} failed: {e}")
        return "Sorry, I couldn't do that move."
    return None
