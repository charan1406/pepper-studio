"""Run the brain as its own process:
    python -m brain --bridge-url http://localhost:5001 --events mock
LLM config comes from the AI seam env vars (same as the bridge)."""
import argparse
import logging
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)                          # for `pepper.client`
sys.path.insert(0, os.path.join(ROOT, "simulator"))  # for `llm`

from pepper.client import PepperClient   # noqa: E402
from llm import SimLLMClient             # noqa: E402

from .brain import Brain                 # noqa: E402
from .engagement import EngagementState  # noqa: E402
from .memory import PeopleMemory         # noqa: E402
from .actions import ActionExecutor      # noqa: E402
from .sources import MockEventSource, demo_script  # noqa: E402


def build_brain(bridge_url):
    llm = SimLLMClient(
        base_url=os.environ.get("SIM_AI_BASE_URL", ""),
        api_key=os.environ.get("SIM_AI_API_KEY", ""),
        model=os.environ.get("SIM_AI_MODEL", "local"),
    )
    client = PepperClient(bridge_url=bridge_url)
    mem_path = os.path.expanduser("~/.pepper-studio/people.json")
    return Brain(llm=llm, executor=ActionExecutor(client),
                 memory=PeopleMemory(mem_path), engagement=EngagementState())


def main():
    logging.basicConfig(level=logging.INFO, format="[brain] %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--bridge-url", default="http://localhost:5001")
    ap.add_argument("--events", choices=["mock"], default="mock")
    args = ap.parse_args()

    brain = build_brain(args.bridge_url)
    if not brain.llm.enabled:
        logging.warning("No LLM configured (set SIM_AI_BASE_URL) — brain will no-op.")
    source = MockEventSource(demo_script(), delay_s=1.0)
    logging.info("Running demo script against %s", args.bridge_url)
    brain.run(source)
    logging.info("Done.")


if __name__ == "__main__":
    main()
