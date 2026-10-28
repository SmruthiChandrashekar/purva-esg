"""
test_rejection_advisor.py — Unit tests for the Policy-Grounded Rejection Advisor.
"""

import unittest
from unittest.mock import patch, MagicMock
from rag.rejection_advisor import evaluate_rejection_reason


class TestRejectionAdvisor(unittest.TestCase):

    @patch("rag.rejection_advisor.is_rag_ready", return_value=True)
    @patch("rag.rejection_advisor.search_policies")
    @patch("rag.rejection_advisor.call_llm")
    def test_premature_rejection_returns_advice(self, mock_llm, mock_search, mock_rag_ready):
        # Mock policy chunks
        mock_doc = MagicMock()
        mock_doc.metadata = {
            "policy_name": "Grievance Redressal Mechanism Framework",
            "section": "Section 4 - Due Diligence",
            "page": 1,
            "source_file": "grm.pdf"
        }
        mock_doc.page_content = "All maintenance complaints must be inspected on-site before rejection."
        mock_search.return_value = [(mock_doc, 0.9)]

        mock_llm.return_value = """{
            "verdict": "REVISE_OR_TAKE_ADVICE",
            "can_escalate": false,
            "compliance_status": "NON_COMPLIANT",
            "policy_name": "Grievance Redressal Mechanism Framework",
            "section": "Section 4 - Due Diligence",
            "summary": "Rejection is non-compliant because an on-site inspection is required.",
            "advice": "Under Section 4, maintenance issues cannot be rejected without physical inspection.",
            "recommended_action": "Schedule 48-hour civil engineering site inspection."
        }"""

        res = evaluate_rejection_reason(
            grievance_text="Customer reports water seepage in bedroom wall.",
            rejection_reason="I don't think this is our problem. Reject.",
            category="Operations",
            officer_tier="L1"
        )

        self.assertEqual(res["verdict"], "REVISE_OR_TAKE_ADVICE")
        self.assertFalse(res["can_escalate"])
        self.assertEqual(res["compliance_status"], "NON_COMPLIANT")
        self.assertIn("Schedule 48-hour civil engineering site inspection", res["recommended_action"])
        self.assertEqual(len(res["citations"]), 1)

    @patch("rag.rejection_advisor.is_rag_ready", return_value=True)
    @patch("rag.rejection_advisor.search_policies")
    @patch("rag.rejection_advisor.call_llm")
    def test_valid_rejection_allows_escalation(self, mock_llm, mock_search, mock_rag_ready):
        mock_doc = MagicMock()
        mock_doc.metadata = {
            "policy_name": "Puravankara Leave Policy",
            "section": "Section 5 - Encashment",
            "page": 2,
            "source_file": "leave_policy.pdf"
        }
        mock_doc.page_content = "Casual leaves are not encashable upon resignation."
        mock_search.return_value = [(mock_doc, 0.95)]

        mock_llm.return_value = """{
            "verdict": "GO_AHEAD",
            "can_escalate": true,
            "compliance_status": "COMPLIANT",
            "policy_name": "Puravankara Leave Policy",
            "section": "Section 5 - Encashment",
            "summary": "Rejection is compliant with Leave Policy rules.",
            "advice": "Casual leaves are strictly non-encashable per Section 5.",
            "recommended_action": "Proceed to escalate to Department Head for final rejection confirmation."
        }"""

        res = evaluate_rejection_reason(
            grievance_text="Demanding cash payout for casual leave balance.",
            rejection_reason="Casual leaves cannot be encashed under Section 5.",
            category="HR",
            officer_tier="L2"
        )

        self.assertEqual(res["verdict"], "GO_AHEAD")
        self.assertTrue(res["can_escalate"])
        self.assertEqual(res["compliance_status"], "COMPLIANT")


if __name__ == "__main__":
    unittest.main()
