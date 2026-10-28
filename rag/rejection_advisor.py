"""
rejection_advisor.py — Policy-grounded AI advisor for grievance rejection proposals.

Before an L1/L2/L3 Maker officer can reject or escalate a grievance for rejection,
this module evaluates their proposed rejection justification against Puravankara's
official corporate, HR, ESG, and customer care policy documents in Chroma/BM25.
"""

import os
import re
import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

from rag.query_data import (
    initialize_rag,
    is_rag_ready,
    search_policies,
    call_llm,
    preprocess_query,
)


def evaluate_rejection_reason(
    grievance_text: str,
    rejection_reason: str,
    category: str = "General",
    officer_tier: str = "L1",
    grievance_id: str = "",
) -> Dict[str, Any]:
    """
    Evaluates whether the officer's rejection reason is supported by Puravankara policies,
    providing structured compliance advice, policy citations, and recommended actions.

    Returns:
        dict:
          - verdict: 'GO_AHEAD' (rejection compliant, can escalate) | 'REVISE_OR_TAKE_ADVICE' (conflict/premature)
          - can_escalate: bool
          - policy_name: str
          - section: str
          - summary: str
          - advice: str
          - recommended_action: str
          - compliance_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PREMATURE'
          - citations: List[dict]
    """
    if not is_rag_ready():
        initialize_rag()

    # Step 1: Hybrid search for policy documents relevant to this grievance & rejection
    search_query = f"{category} grievance redressal {grievance_text[:200]} {rejection_reason[:200]}"
    cleaned_query = preprocess_query(search_query)

    try:
        matching_chunks = search_policies(cleaned_query, top_k=5)
    except Exception as e:
        logger.error("Policy retrieval error in rejection advisor: %s", e)
        matching_chunks = []

    context_blocks = []
    citations = []
    seen_sources = set()

    for doc, score in matching_chunks[:4]:
        policy_name = doc.metadata.get("policy_name", "Puravankara Corporate Policy")
        source_file = doc.metadata.get("source_file", doc.metadata.get("source", "Policy Document"))
        page = doc.metadata.get("page", 1)
        section = doc.metadata.get("section", "General Provisions")
        excerpt = doc.page_content.strip()[:350]

        context_blocks.append(
            f"--- POLICY: {policy_name} (Section: {section}, Page: {page}) ---\n{doc.page_content}\n"
        )

        source_key = (policy_name, page, section)
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            citations.append({
                "source": policy_name,
                "source_file": source_file,
                "page": page,
                "section": section,
                "excerpt": excerpt,
                "score": round(float(score), 3),
            })

    context_text = "\n".join(context_blocks) if context_blocks else "Standard Puravankara Grievance & Fair Operating Guidelines."

    # Step 2: Formulate prompt for Policy Compliance evaluation
    prompt = f"""### ROLE:
You are the Puravankara Enterprise Policy & Compliance Advisor.
Your job is to objectively review an administrator's proposed REJECTION of a grievance before it is submitted.

### CONTEXT:
- Grievance Category/Department: {category}
- Complainant's Grievance:
"{grievance_text}"

- Proposed Rejection Justification given by {officer_tier} Officer:
"{rejection_reason}"

### RELEVANT PURAVANKARA POLICIES:
{context_text}

### OBJECTIVE:
Evaluate whether the administrator's proposed rejection is:
1. COMPLIANT & JUSTIFIED ("GO_AHEAD"): The rejection reason is legitimate under policies (e.g., request violates documented policy, claims already resolved, outside scope, fraudulent, or past statutory limits). The officer is authorized to escalate to the Department Head (HOD).
2. PREMATURE / CONFLICTING ("REVISE_OR_TAKE_ADVICE"): The grievance requires further investigation, mandatory mediation, on-site inspection, or an alternative resolution path under company policy before rejecting.

### INSTRUCTIONS:
You MUST respond ONLY with a valid JSON object formatted as follows, without markdown tags:
{{
  "verdict": "GO_AHEAD" or "REVISE_OR_TAKE_ADVICE",
  "can_escalate": true or false,
  "compliance_status": "COMPLIANT" or "NON_COMPLIANT" or "PREMATURE",
  "policy_name": "Specific policy name referenced",
  "section": "Section or clause number/name",
  "summary": "1-sentence executive verdict",
  "advice": "Clear, constructive 2-3 sentence policy advice explaining why the rejection is approved or what policy conditions are not met.",
  "recommended_action": "Exact concrete next step the officer should take if they accept this advice (e.g., 'Initiate on-site inspection with facility manager' or 'Proceed to escalate to Department Head for final sign-off')."
}}
"""

    response_text = call_llm(prompt)
    logger.info("Rejection Advisor LLM Response: %s", response_text)

    # Clean response
    cleaned_json = response_text.strip()
    if cleaned_json.startswith("```"):
        cleaned_json = re.sub(r"^```(?:json)?\s*", "", cleaned_json)
        cleaned_json = re.sub(r"\s*```$", "", cleaned_json)

    try:
        data = json.loads(cleaned_json)
        # Ensure standard keys
        verdict = data.get("verdict", "REVISE_OR_TAKE_ADVICE")
        can_escalate = bool(data.get("can_escalate", verdict == "GO_AHEAD"))
        return {
            "verdict": verdict,
            "can_escalate": can_escalate,
            "compliance_status": data.get("compliance_status", "PREMATURE" if verdict != "GO_AHEAD" else "COMPLIANT"),
            "policy_name": data.get("policy_name", citations[0]["source"] if citations else "Puravankara Grievance Policy"),
            "section": data.get("section", citations[0]["section"] if citations else "Clause 4 - Resolution Protocol"),
            "summary": data.get("summary", "Policy review completed."),
            "advice": data.get("advice", "Please review internal policy guidelines before finalizing rejection."),
            "recommended_action": data.get("recommended_action", "Investigate grievance details or forward to HOD."),
            "citations": citations,
        }
    except Exception as parse_err:
        logger.warning("Failed to parse LLM response as JSON: %s. Using fallback rule-based parser.", parse_err)
        # Fallback heuristic if LLM returns text
        is_go_ahead = "go_ahead" in response_text.lower() or "justified" in response_text.lower()
        return {
            "verdict": "GO_AHEAD" if is_go_ahead else "REVISE_OR_TAKE_ADVICE",
            "can_escalate": is_go_ahead,
            "compliance_status": "COMPLIANT" if is_go_ahead else "PREMATURE",
            "policy_name": citations[0]["source"] if citations else "Puravankara Grievance Redressal Policy",
            "section": citations[0]["section"] if citations else "Section 3 - Due Diligence",
            "summary": "Policy assessment provided for proposed rejection.",
            "advice": response_text[:300] if len(response_text) > 30 else "Ensure mandatory due-diligence steps have been completed before closing or rejecting.",
            "recommended_action": "Proceed with escalation if satisfied, or verify inspection reports." if is_go_ahead else "Review complaint facts and take corrective measures.",
            "citations": citations,
        }
