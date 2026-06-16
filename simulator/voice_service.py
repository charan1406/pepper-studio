"""In-app voice service: push-to-talk one-turn driver for the Studio backend.

Wraps voice_loop.one_turn (record via the bridge -> STT -> brain -> speak) into a
controllable service with a status dict (state + transcript) the UI polls. The
brain and the bridge URL are supplied by the caller (sim_bridge) so voice uses
the same configured AI as the rest of Studio and talks to whatever bridge the app
is pointed at (sim or a real Pepper). The PepperClient is injectable for tests.
"""
import threading

import voice_loop

_lock = threading.Lock()
_state = {}
_history = []


def _reset_for_test():
    with _lock:
        _state.clear()
        _state.update(state="idle", error="", transcript=[])
    del _history[:]


_reset_for_test()


def status():
    with _lock:
        s = dict(_state)
        s["transcript"] = list(_state["transcript"])
        return s


def clear():
    _reset_for_test()


def _append(role, text, kind=""):
    with _lock:
        _state["transcript"].append({"role": role, "text": text, "kind": kind})
        if len(_state["transcript"]) > 40:
            del _state["transcript"][:-40]


def _default_client(url):
    # Lazy + path insert at call time only: importing this module must NOT add the
    # repo root to sys.path (sim_bridge decoupling invariant, see test_decouple).
    import os
    import sys
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    from pepper.client import PepperClient
    return PepperClient(url)


def _do_turn(brain, bridge_url, seconds, model_size, client_factory):
    try:
        client = client_factory(bridge_url)
        result = voice_loop.one_turn(client, brain, _history, seconds, model_size)
        if not result:
            with _lock:
                _state["error"] = "heard nothing (silence, mic off, or STT unavailable)"
            return
        _append("user", result["heard"], result["lang"])
        _append("pepper", result["reply"], result["kind"])
        with _lock:
            _state["error"] = ""
    except Exception as e:
        with _lock:
            _state["error"] = "%s: %s" % (type(e).__name__, e)
    finally:
        with _lock:
            _state["state"] = "idle"


def talk(brain, bridge_url, seconds=5, model_size="small", client_factory=None):
    """Run one push-to-talk turn on a worker thread. No-op while already busy."""
    with _lock:
        busy = _state["state"] == "busy"
        if not busy:
            _state["state"] = "busy"
            _state["error"] = ""
    if busy:
        return status()
    threading.Thread(
        target=_do_turn,
        args=(brain, bridge_url, seconds, model_size, client_factory or _default_client),
        daemon=True).start()
    return status()
