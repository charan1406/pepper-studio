"""The brain's 'hands': the LLM tool schemas + an executor that maps a tool
call to a bridge client method. The client is injected (PepperClient in prod,
a fake in tests), so the brain only ever speaks the bridge contract."""

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "say", "description": "Speak a sentence aloud.",
        "parameters": {"type": "object", "properties": {
            "text": {"type": "string"}}, "required": ["text"]}}},
    {"type": "function", "function": {
        "name": "look_at", "description": "Turn the head toward a yaw/pitch (radians).",
        "parameters": {"type": "object", "properties": {
            "yaw": {"type": "number"}, "pitch": {"type": "number"}}, "required": ["yaw"]}}},
    {"type": "function", "function": {
        "name": "set_posture", "description": "Go to a named posture.",
        "parameters": {"type": "object", "properties": {
            "posture": {"type": "string",
                        "enum": ["Stand", "StandInit", "StandZero", "Crouch"]}},
            "required": ["posture"]}}},
    {"type": "function", "function": {
        "name": "set_leds", "description": "Set eye LED color (0-255).",
        "parameters": {"type": "object", "properties": {
            "r": {"type": "integer"}, "g": {"type": "integer"}, "b": {"type": "integer"}},
            "required": ["r", "g", "b"]}}},
    {"type": "function", "function": {
        "name": "run_animation", "description": "Run a named gesture/animation.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"}}, "required": ["name"]}}},
]


class ActionExecutor:
    def __init__(self, client):
        self.client = client

    def execute(self, name: str, args: dict) -> tuple:
        try:
            if name == "say":
                self.client.speak(args["text"], args.get("language", "en"))
            elif name == "look_at":
                self.client.set_head(yaw=args.get("yaw", 0.0),
                                     pitch=args.get("pitch", 0.0))
            elif name == "set_posture":
                self.client.set_posture(args["posture"], args.get("speed", 0.5))
            elif name == "set_leds":
                self.client.set_eye_color(args["r"], args["g"], args["b"])
            elif name == "run_animation":
                self.client.run_animation(args["name"])
            else:
                return (False, f"unknown tool: {name}")
        except Exception as e:  # bridge down, bad args — fail soft
            return (False, f"{name} failed: {e}")
        return (True, name)
