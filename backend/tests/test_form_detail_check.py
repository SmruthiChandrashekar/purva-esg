"""
test_form_detail_check.py: the detail check the complaint forms run before filing.

/api/agents/check-complaint runs the chat's own check (check_context_node) on a form:
- enough detail -> sufficient, no question
- not enough -> one follow-up question for the chatbot popup
- fields already filled in on the form (project, location, date) are passed as detail
- earlier follow-ups and their answers are passed as conversation, so after 2 questions
  the form always goes through
- if the check itself fails, the form is let through (never blocks filing)

The AI is replaced with fakes, so these run offline.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")

from fastapi.testclient import TestClient  # noqa: E402
import backend.main as main  # noqa: E402

client = TestClient(main.app)


def _fake_check(result, seen=None):
    def check(state):
        if seen is not None:
            seen.append(state)
        return result
    return check


def test_enough_detail_goes_through(monkeypatch):
    monkeypatch.setattr(main, "check_context_node", _fake_check(
        {"intent": "GRIEVANCE", "context_sufficient": True, "clarification_question": ""}))
    res = client.post("/api/agents/check-complaint", json={"description": "Dust from Tower B site every night since Monday"})
    assert res.status_code == 200
    assert res.json() == {"sufficient": True, "intent": "GRIEVANCE", "question": ""}


def test_missing_detail_returns_one_question(monkeypatch):
    monkeypatch.setattr(main, "check_context_node", _fake_check(
        {"intent": "GRIEVANCE", "context_sufficient": False, "clarification_question": "Where is the leak?"}))
    res = client.post("/api/agents/check-complaint", json={"description": "water leaking"})
    assert res.json()["sufficient"] is False
    assert res.json()["question"] == "Where is the leak?"


def test_form_fields_and_followups_are_passed_as_context(monkeypatch):
    seen = []
    monkeypatch.setattr(main, "check_context_node", _fake_check(
        {"intent": "GRIEVANCE", "context_sufficient": True, "clarification_question": ""}, seen))
    client.post("/api/agents/check-complaint", json={
        "description": "water leaking",
        "project": "Purva Park",
        "location": "Bengaluru",
        "date": "2026-11-17",
        "followups": [{"question": "Where is the leak?", "answer": "Tower B, 4th floor corridor"}],
    })
    state = seen[0]
    assert "Project: Purva Park" in state["user_message"]
    assert "Location: Bengaluru" in state["user_message"]
    assert "Incident date: 2026-11-17" in state["user_message"]
    assert "Tower B, 4th floor corridor" in state["user_message"]
    assert [m["role"] for m in state["messages"]] == ["user", "assistant", "user"]
    assert state["messages"][1]["content"] == "Where is the leak?"


def test_a_failed_check_never_blocks_filing(monkeypatch):
    def broken(state):
        raise RuntimeError("AI down")
    monkeypatch.setattr(main, "check_context_node", broken)
    res = client.post("/api/agents/check-complaint", json={"description": "water leaking"})
    assert res.json()["sufficient"] is True


def test_empty_description_is_not_checked(monkeypatch):
    seen = []
    monkeypatch.setattr(main, "check_context_node", _fake_check({}, seen))
    res = client.post("/api/agents/check-complaint", json={"description": "   "})
    assert res.json()["sufficient"] is True
    assert seen == []


def test_after_two_questions_the_form_goes_through(monkeypatch):
    # The real check_context_node: with 2 follow-ups already asked it lets the form
    # through without asking the AI again.
    import backend.agent.llm as llm

    def no_ai(*a, **k):
        raise AssertionError("the AI should not be asked after 2 follow-ups")

    monkeypatch.setattr(llm, "get_llm", lambda: (type("C", (), {"chat": property(no_ai)})(), "test-model"))
    res = client.post("/api/agents/check-complaint", json={
        "description": "noise",
        "followups": [
            {"question": "Where is the noise coming from?", "answer": "site"},
            {"question": "At what time does it happen?", "answer": "night"},
        ],
    })
    assert res.json()["sufficient"] is True
