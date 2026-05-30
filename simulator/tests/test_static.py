import http.client
import json
import os
import sys
import threading
from http.server import HTTPServer

import pytest

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SIM_DIR)

import sim_bridge  # noqa: E402


@pytest.fixture
def server():
    httpd = HTTPServer(("127.0.0.1", 0), sim_bridge.BridgeHandler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    yield httpd
    httpd.shutdown()


def _conn(server):
    return http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)


def test_health_still_json(server):
    c = _conn(server)
    c.request("GET", "/health")
    resp = c.getresponse()
    data = json.loads(resp.read())
    assert resp.status == 200
    assert data["success"] and data["data"]["simulator"] is True


def test_index_served(server):
    # Requires simulator/web/dist/index.html to exist (built frontend).
    c = _conn(server)
    c.request("GET", "/")
    resp = c.getresponse()
    body = resp.read().decode()
    assert resp.status == 200
    assert 'id="root"' in body


def test_path_traversal_blocked(server):
    c = _conn(server)
    c.request("GET", "/../../sim_bridge.py")
    resp = c.getresponse()
    assert resp.status == 403
