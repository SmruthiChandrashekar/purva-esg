"""
test_escalation_token.py: the chatbot's severity can't be faked by the browser.

/submit-complaint used to trust source="CHATBOT_ESCALATION" plus prefilled severity and
department sent by the browser, so anyone could file their own complaint as High in any
department. Now /api/agents/chat returns a signed escalation_token, and only a valid,
unexpired token for the same text skips the AI classification.

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
            return SimpleNamespace(data=[{"grievance_id": "g-1"}])
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


TEXT = "My site supervisor shouts at me every day in front of the whole crew"


@pytest.fixture
def app(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(main, "supabase", fake)
    monkeypatch.setattr(main, "translate_to_english", lambda t: t)
    monkeypatch.setattr(main, "translate_text", lambda t, lang: t)
    monkeypatch.setattr(main, "escalation_agent", SimpleNamespace(process_async=_noop), raising=False)
    notifier = MagicMock()
    notifier.email_configured = True
    monkeypatch.setattr(main, "notifier", notifier, raising=False)
    calls = {"ai": 0}

    def ai_severity(state):
        calls["ai"] += 1
        return {"severity": "MEDIUM", "classification_failed": False}

    monkeypatch.setattr(main, "classify_severity_node", ai_severity)
    monkeypatch.setattr(main, "classify_department_node", lambda s: {"department": "HR"})
    main.app.dependency_overrides[require_verified_phone] = lambda: {"user_id": "u1", "role": "user"}
    yield TestClient(main.app), fake, calls
    main.app.dependency_overrides.clear()


def _claim(**extra):
    return {"description": TEXT, "source": "CHATBOT_ESCALATION",
            "prefilled_severity": "HIGH", "prefilled_department": "IC", **extra}


def test_claimed_chatbot_severity_without_token_is_ignored(app):
    c, fake, calls = app
    r = c.post("/submit-complaint", json=_claim())
    assert r.status_code == 200, r.text
    assert calls["ai"] == 1                       # classified normally
    assert fake.inserted()[0]["severity"] == "Medium"


def test_valid_token_keeps_the_chatbot_decision(app):
    c, fake, calls = app
    token = main.make_escalation_token("HIGH", "HR", TEXT)
    r = c.post("/submit-complaint", json=_claim(escalation_token=token))
    assert r.status_code == 200, r.text
    assert calls["ai"] == 0                       # chatbot decision reused
    row = fake.inserted()[0]
    assert row["severity"] == "High"
    # The department comes from the token, not the browser's prefilled_department ("IC")
    assert row["category"] != "IC"


def test_token_for_other_text_is_ignored(app):
    c, fake, calls = app
    token = main.make_escalation_token("HIGH", "HR", "a completely different message")
    c.post("/submit-complaint", json=_claim(escalation_token=token))
    assert calls["ai"] == 1
    assert fake.inserted()[0]["severity"] == "Medium"


def test_tampered_token_is_ignored(app):
    c, fake, calls = app
    token = main.make_escalation_token("LOW", "HR", TEXT)
    body, sig = token.rsplit(".", 1)
    forged = main.make_escalation_token("HIGH", "HR", TEXT).rsplit(".", 1)[0] + "." + sig
    c.post("/submit-complaint", json=_claim(escalation_token=forged))
    assert calls["ai"] == 1


def test_expired_token_is_ignored(app, monkeypatch):
    c, fake, calls = app
    token = main.make_escalation_token("HIGH", "HR", TEXT)
    monkeypatch.setattr(main.time, "time", lambda: 10 ** 11)
    assert main.read_escalation_token(token, TEXT) is None


def test_token_tolerates_emoji_and_spacing(app):
    token = main.make_escalation_token("HIGH", "HR", TEXT + " 😡😡")
    assert main.read_escalation_token(token, "  " + TEXT.upper() + "!!") is not None


def test_chat_response_includes_a_token_for_the_message(app, monkeypatch):
    c, fake, calls = app
    monkeypatch.setattr(main, "is_rag_ready", lambda: True)
    monkeypatch.setattr(main, "run_agent", lambda **k: {
        "response": "Please file a formal complaint.", "severity": "HIGH", "department": "HR",
        "intent": "GRIEVANCE", "chatbot_resolved": False,
    })
    r = c.post("/api/agents/chat", json={"message": TEXT, "lang": "en"})
    assert r.status_code == 200, r.text
    decision = main.read_escalation_token(r.json()["escalation_token"], TEXT)
    assert decision and decision["s"] == "HIGH" and decision["d"] == "HR"
