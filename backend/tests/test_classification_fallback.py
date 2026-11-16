"""
test_classification_fallback.py: complaints must not be lost when the AI can't triage them.

When the severity check fails (Groq rate limit, outage or a bad reply) it falls back to
LOW. LOW form submissions are not stored (they are sent to the chatbot instead), so
before this fix a rate-limited complaint vanished. Now:
- the severity check retries a rate-limited call, and flags a real failure;
- a form complaint whose triage failed is stored as MEDIUM.

The AI and Supabase are replaced with fakes, so these run offline.
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
import backend.agent.nodes.classify_severity as cs  # noqa: E402
from backend.middleware.auth import require_verified_phone  # noqa: E402


# ── The severity check itself ────────────────────────────────────────────

class _FakeLLM:
    """Raises the given errors in order, then returns the given reply."""

    def __init__(self, errors, reply='{"reason": "r", "intent": "GRIEVANCE", "severity": "HIGH"}'):
        self.errors, self.reply, self.calls = list(errors), reply, 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls += 1
        if self.errors:
            raise self.errors.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self.reply))])


def _use_llm(monkeypatch, fake):
    import backend.agent.llm as llm
    monkeypatch.setattr(llm, "get_llm", lambda: (fake, "test-model"))
    monkeypatch.setattr(llm, "extract_response_text", lambda m: m.content)
    monkeypatch.setattr(cs.time, "sleep", lambda s: None)


MESSAGE = {"user_message": "The contractor has not paid our wages for two months"}


def test_rate_limit_is_retried_then_succeeds(monkeypatch):
    rate_limited = RuntimeError("Error code: 429 - rate limit reached")
    # Each attempt makes up to two calls (with and without JSON mode)
    fake = _FakeLLM([rate_limited, rate_limited])
    _use_llm(monkeypatch, fake)
    res = cs.classify_severity_node(dict(MESSAGE))
    assert res["severity"] == "HIGH"
    assert res["classification_failed"] is False


def test_persistent_rate_limit_is_flagged_as_failed(monkeypatch):
    fake = _FakeLLM([RuntimeError("Error code: 429 - rate limit reached")] * 10)
    _use_llm(monkeypatch, fake)
    res = cs.classify_severity_node(dict(MESSAGE))
    assert res["severity"] == "LOW"            # fallback value is unchanged
    assert res["classification_failed"] is True


def test_unreadable_reply_is_flagged_as_failed(monkeypatch):
    fake = _FakeLLM([], reply="not json at all")
    _use_llm(monkeypatch, fake)
    res = cs.classify_severity_node(dict(MESSAGE))
    assert res["classification_failed"] is True


def test_real_low_triage_is_not_flagged(monkeypatch):
    fake = _FakeLLM([], reply='{"reason": "r", "intent": "QUERY", "severity": "LOW"}')
    _use_llm(monkeypatch, fake)
    res = cs.classify_severity_node({"user_message": "Where can I find the holiday list?"})
    assert res["severity"] == "LOW" and res["classification_failed"] is False


# ── Filing a complaint through a form ────────────────────────────────────

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

    def inserted(self, table):
        return [o[1][0] for t, ops in self.calls if t == table for o in ops if o[0] == "insert"]


async def _noop(*a, **k):
    return None


@pytest.fixture
def client(monkeypatch):
    fake = _FakeSupabase()
    monkeypatch.setattr(main, "supabase", fake)
    monkeypatch.setattr(main, "translate_to_english", lambda t: t)
    monkeypatch.setattr(main, "classify_department_node", lambda s: {"department": "HR"})
    monkeypatch.setattr(main, "escalation_agent", SimpleNamespace(process_async=_noop), raising=False)
    notifier = MagicMock()
    notifier.email_configured = True
    monkeypatch.setattr(main, "notifier", notifier, raising=False)
    main.app.dependency_overrides[require_verified_phone] = lambda: {"user_id": "u1", "role": "user"}
    yield TestClient(main.app), fake
    main.app.dependency_overrides.clear()


def test_failed_triage_files_the_complaint_as_medium(client, monkeypatch):
    c, fake = client
    monkeypatch.setattr(main, "classify_severity_node", lambda s: {
        "severity": "LOW", "classification_failed": True, "severity_reason": "Classification error: 429"})
    r = c.post("/submit-complaint", json={"description": "The contractor has not paid our wages for two months"})
    assert r.status_code == 200, r.text
    assert r.json().get("redirect") != "assistant"
    rows = fake.inserted("grievances")
    assert len(rows) == 1 and rows[0]["severity"] == "Medium"


def test_real_low_triage_is_still_sent_to_the_assistant(client, monkeypatch):
    c, fake = client
    monkeypatch.setattr(main, "classify_severity_node", lambda s: {
        "severity": "LOW", "classification_failed": False})
    r = c.post("/submit-complaint", json={"description": "Where can I find the holiday list?"})
    assert r.status_code == 200 and r.json()["redirect"] == "assistant"
    assert not fake.inserted("grievances")
