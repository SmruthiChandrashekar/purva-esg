"""
test_guest_and_low_priority.py: guest filing and the low-priority "File it anyway" flow.

- A low-priority concern is not filed straight away: the response carries the policy
  answer so the form can show it. "File it anyway" (file_anyway=True) files the same
  text at L1 without retyping or logging in.
- Guests (no account) can file through /api/guest/complaint, one complaint per hour per
  visitor. A second attempt within the hour gets a 429 with a "come back in N minutes"
  message; the "File it anyway" follow-up for their own low-priority concern is allowed.

Supabase and the AI are replaced with fakes, so these run offline.
"""
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")

from fastapi.testclient import TestClient  # noqa: E402
import backend.main as main  # noqa: E402
from backend.middleware.auth import require_verified_phone  # noqa: E402


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.ops = db, table, []

    def __getattr__(self, name):
        def op(*a, **k):
            self.ops.append((name, a, k))
            return self
        return op

    def execute(self):
        self.db.calls.append((self.table, self.ops))
        if self.table == "grievances" and any(o[0] == "insert" for o in self.ops):
            return SimpleNamespace(data=[{"grievance_id": "g-guest-1"}])
        return SimpleNamespace(data=[])


class _FakeSupabase:
    def __init__(self):
        self.calls = []
        self.auth = SimpleNamespace(admin=MagicMock())
        self.storage = MagicMock()

    def table(self, name):
        return _Query(self, name)

    def inserted(self):
        return [o[1][0] for t, ops in self.calls if t == "grievances" for o in ops if o[0] == "insert"]


async def _noop(*a, **k):
    return None


@pytest.fixture
def app(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(main, "supabase", fake)
    monkeypatch.setattr(main, "translate_to_english", lambda t: t)
    monkeypatch.setattr(main, "classify_department_node", lambda s: {"department": "ESG"})
    monkeypatch.setattr(main, "escalation_agent", SimpleNamespace(process_async=_noop), raising=False)
    monkeypatch.setattr(main, "get_rag_response", lambda q: {
        "answer": "Per the Visitor Policy, visitor parking is available at Gate 2.",
        "sources": [{"source": "Visitor Policy"}],
    })
    notifier = MagicMock()
    notifier.email_configured = True
    monkeypatch.setattr(main, "notifier", notifier, raising=False)
    main._guest_activity.clear()
    main.app.dependency_overrides[require_verified_phone] = lambda: {"user_id": "u1", "role": "user"}
    yield TestClient(main.app), fake, monkeypatch
    main.app.dependency_overrides.clear()
    main._guest_activity.clear()


def _severity(monkeypatch, sev):
    monkeypatch.setattr(main, "classify_severity_node",
                        lambda s: {"severity": sev, "classification_failed": False})


GUEST = {"description": "Construction dust from the site is covering our balcony every day",
         "project": "Purva Heritage"}
VISITOR = {"X-Forwarded-For": "203.0.113.7"}


# ── Low-priority concerns: answer first, then "File it anyway" ──────────────

def test_low_priority_returns_policy_answer_and_files_nothing(app):
    c, fake, mp = app
    _severity(mp, "LOW")
    r = c.post("/submit-complaint", json={"description": "Where can visitors park their cars?"})
    body = r.json()
    assert r.status_code == 200 and body["redirect"] == "assistant"
    assert "Gate 2" in body["answer"] and body["sources"] == ["Visitor Policy"]
    assert not fake.inserted()


def test_file_it_anyway_files_low_concern_at_l1(app):
    c, fake, mp = app
    _severity(mp, "LOW")
    r = c.post("/submit-complaint", json={"description": "Where can visitors park their cars?",
                                          "file_anyway": True})
    assert r.status_code == 200, r.text
    rows = fake.inserted()
    assert len(rows) == 1
    assert rows[0]["severity"] == "Low" and rows[0]["assigned_tier"] == "L1"
    assert rows[0]["status"] == "HUMAN_HANDLING"


# ── Guests ───────────────────────────────────────────────────────────────

def test_guest_complaint_is_really_filed(app):
    c, fake, mp = app
    _severity(mp, "MEDIUM")
    r = c.post("/api/guest/complaint", json=GUEST, headers=VISITOR)
    assert r.status_code == 200, r.text
    assert r.json()["grievance_id"] == "g-guest-1"
    row = fake.inserted()[0]
    assert row["user_id"] is None
    assert "Purva Heritage" in (row["location"] or "")


def test_guest_second_complaint_within_the_hour_is_refused(app):
    c, fake, mp = app
    _severity(mp, "MEDIUM")
    assert c.post("/api/guest/complaint", json=GUEST, headers=VISITOR).status_code == 200
    r = c.post("/api/guest/complaint", json=GUEST, headers=VISITOR)
    assert r.status_code == 429
    assert "one complaint per hour" in r.json()["detail"]
    assert "come back in" in r.json()["detail"]
    assert int(r.headers["Retry-After"]) > 3000
    assert len(fake.inserted()) == 1


def test_guest_limit_is_per_visitor(app):
    c, fake, mp = app
    _severity(mp, "MEDIUM")
    assert c.post("/api/guest/complaint", json=GUEST, headers=VISITOR).status_code == 200
    other = {"X-Forwarded-For": "198.51.100.20"}
    assert c.post("/api/guest/complaint", json=GUEST, headers=other).status_code == 200


def test_guest_can_file_their_low_concern_anyway_once(app):
    c, fake, mp = app
    _severity(mp, "LOW")
    first = c.post("/api/guest/complaint", json=GUEST, headers=VISITOR)
    assert first.json()["redirect"] == "assistant" and first.json()["answer"]
    second = c.post("/api/guest/complaint", json={**GUEST, "file_anyway": True}, headers=VISITOR)
    assert second.status_code == 200 and second.json()["grievance_id"] == "g-guest-1"
    third = c.post("/api/guest/complaint", json={**GUEST, "file_anyway": True}, headers=VISITOR)
    assert third.status_code == 429
    assert len(fake.inserted()) == 1


def test_guest_new_concern_after_a_low_answer_waits_an_hour(app):
    c, fake, mp = app
    _severity(mp, "LOW")
    c.post("/api/guest/complaint", json=GUEST, headers=VISITOR)
    r = c.post("/api/guest/complaint", json={**GUEST, "description": "Another, different issue here"},
               headers=VISITOR)
    assert r.status_code == 429


def test_guest_future_incident_date_is_rejected_without_using_the_hour(app):
    c, fake, mp = app
    _severity(mp, "MEDIUM")
    r = c.post("/api/guest/complaint", json={**GUEST, "date": "2999-01-01"}, headers=VISITOR)
    assert r.status_code == 422 and "future" in r.json()["detail"]
    assert c.post("/api/guest/complaint", json=GUEST, headers=VISITOR).status_code == 200


def test_guest_anonymous_drops_contact_details(app):
    c, fake, mp = app
    _severity(mp, "HIGH")
    c.post("/api/guest/complaint", json={**GUEST, "is_anonymous": True, "name": "Asha",
                                         "phone": "9999999999", "email": "a@example.com"},
           headers=VISITOR)
    row = fake.inserted()[0]
    assert row["submitter_name"] is None and row["contact_phone"] is None and row["contact_email"] is None


def test_guest_cannot_set_severity(app):
    c, fake, mp = app
    _severity(mp, "MEDIUM")
    c.post("/api/guest/complaint", json={**GUEST, "severity": "High", "prefilled_severity": "High"},
           headers=VISITOR)
    assert fake.inserted()[0]["severity"] == "Medium"
