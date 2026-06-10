"""
Minimal OpenAI-compatible chat client for the standalone simulator.

Stdlib only — no dependency on the pepper-ai project or third-party HTTP libs.
Works against any OpenAI-compatible /chat/completions endpoint: local
(llama-server, Ollama, LM Studio) or cloud (set base_url + api_key).
"""
import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


@dataclass
class LLMResult:
    success: bool
    content: str = ""
    error: str | None = None
    tok_per_sec: float = 0.0
    tool_calls: list | None = None


class SimLLMClient:
    """One blocking call to an OpenAI-compatible chat endpoint.

    AI is optional: if base_url is empty, .enabled is False and callers should
    fall back to mock responses.
    """

    def __init__(self, base_url="", api_key="", model="local", timeout=60):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    @property
    def enabled(self) -> bool:
        return bool(self.base_url)

    def chat(self, message, system=None, history=None) -> LLMResult:
        if not self.enabled:
            return LLMResult(success=False, error="AI disabled (no base_url)")

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": message})

        payload = json.dumps({
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "stream": False,
        }).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=payload, headers=headers, method="POST",
        )

        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as e:
            return LLMResult(success=False, error=f"{type(e).__name__}: {e}")
        except (TimeoutError, OSError) as e:
            # socket read-timeout is a raw TimeoutError, not wrapped in URLError
            return LLMResult(success=False, error=f"{type(e).__name__}: {e}")
        except ValueError as e:
            return LLMResult(success=False, error=f"Bad JSON: {e}")

        try:
            msg = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError):
            return LLMResult(success=False, error="Unexpected response schema (missing choices/message)")

        content = (msg.get("content") or msg.get("reasoning_content") or "")
        content = _THINK_RE.sub("", content).strip()
        if not content:
            return LLMResult(success=False, error="Empty content")

        elapsed = max(time.time() - t0, 1e-6)
        completion_tokens = (data.get("usage") or {}).get("completion_tokens", 0)
        tok_per_sec = completion_tokens / elapsed if completion_tokens else 0.0
        return LLMResult(success=True, content=content, tok_per_sec=tok_per_sec)

    def chat_tools(self, messages, tools) -> LLMResult:
        """Tool-calling chat. Returns LLMResult with .tool_calls = [{'name','args'}]."""
        if not self.enabled:
            return LLMResult(success=False, error="AI disabled (no base_url)", tool_calls=[])

        body = {"model": self.model, "messages": messages,
                "temperature": 0.7, "stream": False}
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        payload = json.dumps(body).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=payload, headers=headers, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as e:
            return LLMResult(success=False, error=f"{type(e).__name__}: {e}", tool_calls=[])
        except (TimeoutError, OSError) as e:
            return LLMResult(success=False, error=f"{type(e).__name__}: {e}", tool_calls=[])
        except ValueError as e:
            return LLMResult(success=False, error=f"Bad JSON: {e}", tool_calls=[])

        try:
            msg = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError):
            return LLMResult(success=False, error="Unexpected response schema (missing choices/message)", tool_calls=[])

        calls = []
        for tc in (msg.get("tool_calls") or []):
            if not isinstance(tc, dict):
                continue
            fn = tc.get("function") or {}
            name = fn.get("name")
            if not name:
                continue
            raw = fn.get("arguments") or "{}"
            try:
                args = json.loads(raw) if isinstance(raw, str) else dict(raw)
            except ValueError:
                args = {}
            calls.append({"name": name, "args": args})

        content = _THINK_RE.sub("", msg.get("content") or "").strip()
        if not calls and not content:
            return LLMResult(success=False,
                             error="Empty response (no tool_calls, no content)",
                             tool_calls=[])
        return LLMResult(success=True, content=content, tool_calls=calls)
