"""Tests for services.py — docker SearXNG control with an injected fake runner."""
import os
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

import services  # noqa: E402


def _runner(*results):
    """Return a fake docker runner that yields the given (code, out, err) tuples."""
    seq = list(results)

    def run(args, timeout=15):
        return seq.pop(0) if seq else (0, "", "")
    return run


def test_status_running():
    run = _runner((0, "true", ""))
    st = services.status(run=run)
    assert st == {"container": "searxng", "present": True, "running": True, "error": ""}


def test_status_stopped():
    run = _runner((0, "false", ""))
    assert services.status(run=run)["running"] is False


def test_status_absent():
    run = _runner((1, "", "No such object: searxng"))
    st = services.status(run=run)
    assert st["present"] is False and st["running"] is False
    assert "No such object" in st["error"]


def test_status_docker_missing():
    run = _runner((127, "", "docker not found — install Docker or start SearXNG yourself"))
    assert "docker not found" in services.status(run=run)["error"]


def test_start_then_running():
    # start returns 0, then status reports running
    run = _runner((0, "", ""), (0, "true", ""))
    st = services.start(run=run)
    assert st["running"] is True and st["error"] == ""


def test_start_failure_surfaces_error():
    run = _runner((1, "", "Error response from daemon: no such container"), (1, "", "No such object"))
    st = services.start(run=run)
    assert st["running"] is False
    assert st["error"]


def test_stop_then_stopped():
    run = _runner((0, "", ""), (0, "false", ""))
    st = services.stop(run=run)
    assert st["running"] is False


# ── endpoint (against a live bridge subprocess; docker likely absent) ──

import json as _json  # noqa: E402
import urllib.request  # noqa: E402


def test_services_status_endpoint(bridge):
    with urllib.request.urlopen(bridge + "/services/status", timeout=10) as r:
        data = _json.loads(r.read())
    assert data["success"] is True
    assert "searxng" in data["data"]
    assert "running" in data["data"]["searxng"]  # shape present even if docker absent
