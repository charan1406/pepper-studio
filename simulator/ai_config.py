"""Persisted AI-dial config for the standalone simulator. Stdlib only.

Stores base_url/api_key/model/timeout in ~/.pepper-studio/ai.json (0600,
atomic write). On first run (no file) seeds from SIM_AI_* env vars so existing
setups keep working; after that the file wins.
"""
import json
import os

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".pepper-studio")
CONFIG_PATH = os.path.join(CONFIG_DIR, "ai.json")

DEFAULTS = {"base_url": "", "api_key": "", "model": "local", "timeout": 60}
_KEYS = ("base_url", "api_key", "model", "timeout")


def _coerce_timeout(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return DEFAULTS["timeout"]


def _from_env():
    return {
        "base_url": os.environ.get("SIM_AI_BASE_URL", ""),
        "api_key": os.environ.get("SIM_AI_API_KEY", ""),
        "model": os.environ.get("SIM_AI_MODEL", "local"),
        "timeout": _coerce_timeout(os.environ.get("SIM_AI_TIMEOUT", "60")),
    }


def load():
    """Return the config dict: file if present, else env-seeded defaults.

    A corrupt file is backed up to ai.json.bad and we fall through to the
    env-seeded path — same as a missing file — so SIM_AI_* env vars are still
    honored instead of being silently dropped.
    """
    if os.path.isfile(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as f:
                data = json.load(f)
            cfg = dict(DEFAULTS)
            cfg.update({k: data[k] for k in _KEYS if k in data})
            cfg["timeout"] = _coerce_timeout(cfg["timeout"])
            return cfg
        except (ValueError, OSError) as e:
            try:
                os.replace(CONFIG_PATH, CONFIG_PATH + ".bad")
            except OSError:
                pass
            print(f"[AI] config corrupt ({e}); backed up to ai.json.bad, seeding from env/defaults")
    cfg = dict(DEFAULTS)
    cfg.update(_from_env())
    return cfg


def save(cfg):
    """Atomically write config (0600). Returns False if it can't persist."""
    try:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        out = {k: cfg.get(k, DEFAULTS[k]) for k in _KEYS}
        out["timeout"] = _coerce_timeout(out["timeout"])
        tmp = CONFIG_PATH + ".tmp"
        with open(tmp, "w") as f:
            json.dump(out, f, indent=2)
        os.chmod(tmp, 0o600)          # lock down before it lands at CONFIG_PATH
        os.replace(tmp, CONFIG_PATH)
        return True
    except OSError as e:
        print(f"[AI] could not persist config: {e}")
        return False
