"""Docker-managed external services (currently SearXNG for web search).

Studio-side. Controls a docker container by name with an args-as-list subprocess
(never shell=True). Degrades gracefully when docker isn't installed. The runner
function is injectable so tests don't need docker.
"""
import subprocess


def _run(args, timeout=15):
    try:
        r = subprocess.run(["docker"] + args, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()
    except FileNotFoundError:
        return 127, "", "docker not found — install Docker or start SearXNG yourself"
    except subprocess.TimeoutExpired:
        return 124, "", "docker timed out"


def status(container="searxng", run=_run):
    code, out, err = run(["inspect", "-f", "{{.State.Running}}", container])
    if code != 0:
        return {"container": container, "present": False, "running": False,
                "error": err or "container not found"}
    return {"container": container, "present": True, "running": out == "true", "error": ""}


def start(container="searxng", run=_run):
    code, _out, err = run(["start", container])
    st = status(container, run=run)
    if code != 0 and not st["running"]:
        st["error"] = err or st["error"]
    return st


def stop(container="searxng", run=_run):
    code, _out, err = run(["stop", container])
    st = status(container, run=run)
    if code != 0 and st["running"]:
        st["error"] = err or st["error"]
    return st
