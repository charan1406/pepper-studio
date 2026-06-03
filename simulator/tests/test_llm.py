import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

from llm import SimLLMClient  # noqa: E402


class _StubHandler(BaseHTTPRequestHandler):
    response_body = {}

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        self.rfile.read(length)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(type(self).response_body).encode())

    def log_message(self, *args):
        pass


@pytest.fixture
def stub():
    _StubHandler.response_body = {}  # reset shared class state per test
    server = HTTPServer(("127.0.0.1", 0), _StubHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    yield server
    server.shutdown()


def _client_for(stub, **kw):
    port = stub.server_address[1]
    return SimLLMClient(base_url=f"http://127.0.0.1:{port}", **kw)


def test_disabled_when_no_base_url():
    c = SimLLMClient(base_url="")
    assert c.enabled is False
    r = c.chat("hi")
    assert r.success is False


def test_chat_parses_openai_response(stub):
    _StubHandler.response_body = {
        "choices": [{"message": {"content": "Hello there"}}],
        "usage": {"completion_tokens": 2},
    }
    r = _client_for(stub).chat("hi")
    assert r.success is True
    assert r.content == "Hello there"


def test_strips_think_blocks(stub):
    _StubHandler.response_body = {
        "choices": [{"message": {"content": "<think>planning</think>Answer"}}]
    }
    r = _client_for(stub).chat("hi")
    assert r.content == "Answer"


def test_falls_back_to_reasoning_content(stub):
    _StubHandler.response_body = {
        "choices": [{"message": {"content": "", "reasoning_content": "Fallback"}}]
    }
    r = _client_for(stub).chat("hi")
    assert r.content == "Fallback"


def test_connection_error_is_handled():
    c = SimLLMClient(base_url="http://127.0.0.1:1")  # nothing listening
    r = c.chat("hi")
    assert r.success is False
    assert r.error


def test_chat_tools_parses_tool_calls(stub):
    _StubHandler.response_body = {
        "choices": [{"message": {
            "content": "",
            "tool_calls": [{
                "id": "call_1", "type": "function",
                "function": {"name": "say", "arguments": "{\"text\": \"hello\"}"},
            }],
        }}]
    }
    r = _client_for(stub).chat_tools(
        messages=[{"role": "user", "content": "hi"}],
        tools=[{"type": "function", "function": {"name": "say", "parameters": {}}}],
    )
    assert r.success is True
    assert r.tool_calls == [{"name": "say", "args": {"text": "hello"}}]


def test_chat_tools_no_calls_is_success_with_empty_list(stub):
    _StubHandler.response_body = {"choices": [{"message": {"content": "just text"}}]}
    r = _client_for(stub).chat_tools(messages=[{"role": "user", "content": "hi"}], tools=[])
    assert r.success is True
    assert r.tool_calls == []
    assert r.content == "just text"


def test_chat_tools_disabled_when_no_base_url():
    c = SimLLMClient(base_url="")
    r = c.chat_tools(messages=[{"role": "user", "content": "hi"}], tools=[])
    assert r.success is False
    assert r.tool_calls == []


def test_chat_tools_bad_arguments_json_defaults_empty(stub):
    _StubHandler.response_body = {"choices": [{"message": {
        "content": "",
        "tool_calls": [{"function": {"name": "say", "arguments": "not-json"}}],
    }}]}
    r = _client_for(stub).chat_tools(messages=[{"role": "user", "content": "hi"}], tools=[])
    assert r.tool_calls == [{"name": "say", "args": {}}]


def test_chat_tools_parses_multiple_calls(stub):
    _StubHandler.response_body = {"choices": [{"message": {
        "content": "",
        "tool_calls": [
            {"function": {"name": "look_at", "arguments": "{\"yaw\": 0.5}"}},
            {"function": {"name": "say", "arguments": "{\"text\": \"hi\"}"}},
        ],
    }}]}
    r = _client_for(stub).chat_tools(messages=[{"role": "user", "content": "hi"}], tools=[])
    assert r.tool_calls == [
        {"name": "look_at", "args": {"yaw": 0.5}},
        {"name": "say", "args": {"text": "hi"}},
    ]


def test_chat_tools_connection_error_is_handled():
    c = SimLLMClient(base_url="http://127.0.0.1:1")
    r = c.chat_tools(messages=[{"role": "user", "content": "hi"}], tools=[])
    assert r.success is False
    assert r.tool_calls == []
