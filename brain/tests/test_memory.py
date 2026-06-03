import json
from brain.memory import PeopleMemory


def test_upsert_and_get(tmp_path):
    m = PeopleMemory(str(tmp_path / "people.json"))
    assert m.get("alice") is None
    m.upsert("alice", name="Alice", notes="likes jazz")
    got = m.get("alice")
    assert got["name"] == "Alice"
    assert got["notes"] == "likes jazz"


def test_upsert_merges_fields(tmp_path):
    m = PeopleMemory(str(tmp_path / "people.json"))
    m.upsert("alice", name="Alice")
    m.upsert("alice", notes="met twice")
    got = m.get("alice")
    assert got["name"] == "Alice" and got["notes"] == "met twice"


def test_persists_across_instances(tmp_path):
    path = str(tmp_path / "people.json")
    PeopleMemory(path).upsert("bob", name="Bob")
    assert PeopleMemory(path).get("bob")["name"] == "Bob"


def test_corrupt_file_starts_empty(tmp_path):
    path = tmp_path / "people.json"
    path.write_text("{not valid json")
    m = PeopleMemory(str(path))
    assert m.get("alice") is None
    m.upsert("alice", name="Alice")  # still writable
    assert m.get("alice")["name"] == "Alice"


def test_write_is_atomic_no_tmp_left(tmp_path):
    path = tmp_path / "people.json"
    PeopleMemory(str(path)).upsert("alice", name="Alice")
    assert not (tmp_path / "people.json.tmp").exists()
    json.loads(path.read_text())  # valid JSON on disk
