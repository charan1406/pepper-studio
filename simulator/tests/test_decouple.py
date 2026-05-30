import os
import subprocess
import sys

SIM_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_sim_bridge_imports_without_brains():
    # Import sim_bridge from the simulator dir. It must NOT pull in the
    # pepper-ai `brains` package, and must NOT mutate sys.path to add its
    # parent dir (the old decoupling hack). Both are checked in a subprocess.
    code = (
        "import sys, os; import sim_bridge; "
        "assert 'brains' not in sys.modules, 'sim_bridge still imports brains'; "
        "parent = os.path.dirname(os.path.dirname(os.path.abspath(sim_bridge.__file__))); "
        "assert parent not in sys.path, 'sim_bridge re-added its parent to sys.path (decoupling hack)'; "
        "print('DECOUPLED_OK')"
    )
    env = dict(os.environ)
    env["SIM_OPEN_BROWSER"] = "0"
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=SIM_DIR, env=env, capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert "DECOUPLED_OK" in result.stdout
