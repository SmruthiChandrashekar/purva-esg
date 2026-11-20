import "./SafetyBadge.css";

// Shown on replies the safety gate stopped (backend/agent/safety.py), so people can see
// the answer is a fixed safety reply and why.
const LABELS = {
  HARMFUL_INTENT: { icon: "bi-shield-fill-x", text: "Safety guardrail · harmful request declined", tone: "danger" },
  CRISIS: { icon: "bi-heart-pulse", text: "Safety guardrail · support resources", tone: "care" },
  INJECTION: { icon: "bi-shield-lock", text: "Safety guardrail · instruction attempt ignored", tone: "danger" },
  ABUSE: { icon: "bi-shield-check", text: "Safety guardrail", tone: "neutral" },
  OUT_OF_SCOPE: { icon: "bi-signpost-split", text: "Outside Purva's scope", tone: "neutral" },
};

export default function SafetyBadge({ category }) {
  const info = LABELS[category];
  if (!info) return null;
  return (
    <div className={`safety-badge is-${info.tone}`} role="note">
      <i className={`bi ${info.icon}`} aria-hidden="true"></i>
      <span>{info.text}</span>
    </div>
  );
}
