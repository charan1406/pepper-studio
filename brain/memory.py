"""Face-ID-keyed person memory. Pure storage (no LLM) with atomic writes so a
crash can't corrupt the file. The brain decides what to store; this just keeps
it."""
import json
import os


class PeopleMemory:
    def __init__(self, path: str):
        self.path = path
        self._data = self._load()

    def _load(self) -> dict:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (FileNotFoundError, ValueError):
            return {}

    def get(self, face_id):
        return self._data.get(face_id)

    def upsert(self, face_id, **fields):
        record = self._data.get(face_id, {})
        record.update(fields)
        self._data[face_id] = record
        self._save()

    def _save(self):
        d = os.path.dirname(self.path)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2)
        os.replace(tmp, self.path)  # atomic
