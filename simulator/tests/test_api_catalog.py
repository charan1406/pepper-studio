import json
import os
import urllib.error
import urllib.request

CATALOG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "web", "src", "lib", "api_catalog.json",
)


def _load():
    with open(CATALOG) as f:
        return json.load(f)


def _hit(base, entry):
    url = base + entry["path"]
    if entry["method"] == "GET":
        req = urllib.request.Request(url)
    else:
        req = urllib.request.Request(
            url, method="POST",
            data=json.dumps(entry.get("body") or {}).encode(),
            headers={"Content-Type": "application/json"},
        )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_catalog_nonempty_and_sections():
    catalog = _load()
    assert catalog, "catalog is empty"
    sections = {e["section"] for e in catalog}
    assert "Robot API" in sections and "Studio API" in sections
    for e in catalog:
        assert e["method"] in ("GET", "POST")
        assert e["path"].startswith("/")
        assert e["desc"]


def test_every_catalog_path_resolves(ai_bridge):
    for entry in _load():
        status, resp = _hit(ai_bridge.base, entry)
        assert status != 404, f"{entry['method']} {entry['path']} → 404"
        if isinstance(resp, dict):
            err = resp.get("error") or ""
            assert not err.startswith("Unknown endpoint"), f"{entry['path']} → {err}"
