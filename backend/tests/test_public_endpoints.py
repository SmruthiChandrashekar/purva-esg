"""
test_public_endpoints.py: endpoints that need no login must not leak staff data.

- GET /api/admin/grievances?admin_id=... used to return an admin's assigned complaints
  to anyone who knew that admin's id. It is removed.
- The public Track lookup must not return assigned_to (the staff member's user id).

Supabase is replaced with a fake, so these run offline.
"""
import os
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")

from fastapi.testclient import TestClient  # noqa: E402
import backend.main as main  # noqa: E402

GRIEVANCE = {
    "grievance_id": "34c83bc2-0000-4000-8000-000000000001",
    "status": "Open", "category": "HR", "severity": "Medium", "description": "x",
    "department": "HR", "assigned_to": "99999999-9999-4999-8999-999999999999",
    "created_at": "2026-11-01T00:00:00+00:00",
}


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def __getattr__(self, name):
        return lambda *a, **k: self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class _FakeSupabase:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        return _Query(self.rows if name == "grievances" else [])


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "supabase", _FakeSupabase([GRIEVANCE]))
    return TestClient(main.app)


def test_open_admin_grievances_endpoint_is_gone(client):
    r = client.get("/api/admin/grievances", params={"admin_id": GRIEVANCE["assigned_to"]})
    assert r.status_code in (404, 405), r.text
    assert "grievances" not in r.text


def test_track_does_not_return_staff_id(client):
    r = client.get("/api/track/34c83bc2")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "assigned_to" not in body
    assert GRIEVANCE["assigned_to"] not in r.text
    assert body["grievance_id"] == GRIEVANCE["grievance_id"]
