import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../services/supabaseClient";
import ProjectPicker from "./ProjectPicker";
import { initialProject } from "../utils/projectSelection";
import { todayLocalISO } from "../utils/dates";

const EMPTY = { description: "", date: "", isAnonymous: false, name: "", phone: "", email: "" };

// Turns a FastAPI error body into one readable sentence.
function errorText(body, status) {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return d.map((x) => String(x.msg || "").replace(/^Value error, /, "")).join(" ");
  return `Something went wrong (error ${status}). Your complaint was not filed. Please try again.`;
}

/**
 * Complaint form for visitors without an account. Files through /api/guest/complaint
 * (one complaint per visitor per hour). The AI decides severity, so there is no severity
 * field. A low-priority concern first gets the policy answer, with "File it anyway".
 */
export default function GuestComplaintForm({ onLogin }) {
  const navigate = useNavigate();
  const { langCode } = useLanguage();
  const [project, setProject] = useState(() => initialProject(window.location.search));
  const [data, setData] = useState(EMPTY);
  const [step, setStep] = useState("form"); // form | answer | filed | resolved
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { text, kind: "limit" | "error" }
  const [answer, setAnswer] = useState(null); // { text, sources }
  const [ticket, setTicket] = useState(null);
  const [copied, setCopied] = useState(false);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setError(null);
  };

  const send = async (fileAnyway) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/guest/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: data.description.trim(),
          lang: langCode || "en",
          project: project?.name || null,
          date: data.date || null,
          name: data.isAnonymous ? null : data.name.trim() || null,
          phone: data.isAnonymous ? null : data.phone.trim() || null,
          email: data.isAnonymous ? null : data.email.trim() || null,
          is_anonymous: data.isAnonymous,
          file_anyway: fileAnyway,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ text: errorText(body, res.status), kind: res.status === 429 ? "limit" : "error" });
        return;
      }
      if (body.grievance_id) {
        setTicket(String(body.grievance_id));
        setStep("filed");
        try { sessionStorage.setItem("isGuest", "true"); } catch { /* storage blocked */ }
      } else if (body.redirect === "assistant") {
        setAnswer({ text: body.answer, sources: body.sources || [] });
        setStep("answer");
      } else {
        setError({ text: "Your complaint was not filed. Please try again.", kind: "error" });
      }
    } catch {
      setError({ text: "Couldn't reach the server, so your complaint was NOT filed. Check your connection and try again.", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (data.description.trim().length < 10) {
      setError({ text: "Please describe what happened (at least 10 characters).", kind: "error" });
      return;
    }
    send(false);
  };

  const startOver = () => {
    setData(EMPTY);
    setAnswer(null);
    setTicket(null);
    setError(null);
    setStep("form");
  };

  const shortId = ticket ? ticket.slice(0, 8).toUpperCase() : "";

  const errorBox = error && (
    <div className={`alert ${error.kind === "limit" ? "alert-warning" : "alert-danger"} small mb-3`} role="alert">
      {error.kind === "limit" && <i className="bi bi-clock-history me-2"></i>}
      {error.text}
    </div>
  );

  if (step === "filed") {
    return (
      <div className="text-center py-3">
        <div className="mb-3 text-success"><i className="bi bi-check-circle-fill fs-1"></i></div>
        <h4 className="fw-bold text-navy mb-2">Complaint filed</h4>
        <p className="text-muted small mb-3">
          Save this tracking ID. As a guest, it is the only way to follow your complaint.
          {data.email && !data.isAnonymous ? " We've also emailed it to you." : ""}
        </p>
        <div className="bg-light border rounded-3 p-3 mb-3">
          <div className="text-muted small text-uppercase mb-1">Tracking ID</div>
          <div className="fw-bold fs-3 text-danger ls-1">{shortId}</div>
          <div className="text-muted small text-break">{ticket}</div>
          <button
            type="button"
            className="btn btn-link btn-sm text-decoration-none mt-1"
            onClick={() => {
              navigator.clipboard?.writeText(ticket).then(() => setCopied(true)).catch(() => {});
            }}
          >
            <i className="bi bi-clipboard me-1"></i>{copied ? "Copied" : "Copy full ID"}
          </button>
        </div>
        <div className="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" className="btn btn-purva-navy px-4 fw-semibold" onClick={() => navigate(`/track?id=${encodeURIComponent(ticket)}`)}>
            Track status &rarr;
          </button>
          <button type="button" className="btn btn-outline-secondary px-4 fw-semibold" onClick={onLogin}>
            Log in or register
          </button>
        </div>
      </div>
    );
  }

  if (step === "resolved") {
    return (
      <div className="text-center py-3">
        <div className="mb-3 text-success"><i className="bi bi-emoji-smile fs-1"></i></div>
        <h4 className="fw-bold text-navy mb-2">Glad that helped</h4>
        <p className="text-muted small mb-3">
          Nothing was filed. If the problem comes back you can file it from this page
          (guests can file one complaint per hour) or ask Purva anytime.
        </p>
        <div className="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" className="btn btn-purva-navy px-4 fw-semibold" onClick={() => navigate("/assistant")}>
            Ask Purva
          </button>
          <button type="button" className="btn btn-outline-secondary px-4 fw-semibold" onClick={startOver}>
            Back to the form
          </button>
        </div>
      </div>
    );
  }

  if (step === "answer") {
    return (
      <div>
        <h4 className="fw-bold text-navy mb-2">This may already be answered</h4>
        <p className="text-muted small mb-3">
          Our assistant rated this a low-priority concern, so it hasn't been filed yet. Here's what
          the Puravankara policies say:
        </p>
        <div className="border rounded-3 p-3 mb-3 bg-light small" style={{ whiteSpace: "pre-wrap" }}>
          {answer?.text || "No policy answer is available right now."}
          {answer?.sources?.length > 0 && (
            <div className="text-muted mt-2"><strong>Sources:</strong> {answer.sources.join(", ")}</div>
          )}
        </div>
        {errorBox}
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-outline-secondary fw-semibold" disabled={busy} onClick={() => setStep("resolved")}>
            That answers it
          </button>
          <button type="button" className="btn btn-danger fw-semibold" disabled={busy} onClick={() => send(true)}>
            {busy ? "Filing..." : "File it anyway"}
          </button>
        </div>
        <p className="text-muted small mt-2 mb-0">"File it anyway" files the complaint you wrote; you don't need to type it again.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-3">
        <h4 className="fw-bold mb-1 text-navy">File a complaint as a guest</h4>
        <p className="text-muted small mb-0">
          No account needed. You'll get a tracking ID. Guests can file one complaint per hour;{" "}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onLogin}>log in</button>{" "}
          to file more or attach files.
        </p>
      </div>

      <ProjectPicker value={project} onChange={setProject} />

      <div className="mb-3">
        <label htmlFor="guest-description" className="form-label fw-semibold text-navy small mb-1">
          What happened? <span className="text-danger">*</span>
        </label>
        <textarea
          id="guest-description"
          name="description"
          className="form-control auth-input"
          rows={4}
          maxLength={5000}
          placeholder="Describe the problem: what, where and since when."
          value={data.description}
          onChange={change}
          disabled={busy}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="guest-date" className="form-label fw-semibold text-navy small mb-1">
          When did it happen? <span className="fw-normal text-muted">(optional)</span>
        </label>
        <input
          id="guest-date"
          type="date"
          name="date"
          className="form-control auth-input"
          max={todayLocalISO()}
          value={data.date}
          onChange={change}
          disabled={busy}
        />
      </div>

      <div className="form-check mb-3">
        <input className="form-check-input" type="checkbox" id="guest-anon" name="isAnonymous" checked={data.isAnonymous} onChange={change} disabled={busy} />
        <label className="form-check-label small" htmlFor="guest-anon">
          File anonymously (don't share my name or contact details)
        </label>
      </div>

      {!data.isAnonymous && (
        <div className="row g-2 mb-3">
          <div className="col-12">
            <label htmlFor="guest-name" className="form-label fw-semibold text-navy small mb-1">
              Your name <span className="fw-normal text-muted">(optional)</span>
            </label>
            <input id="guest-name" name="name" className="form-control auth-input" maxLength={120} value={data.name} onChange={change} disabled={busy} />
          </div>
          <div className="col-12 col-sm-6">
            <label htmlFor="guest-phone" className="form-label fw-semibold text-navy small mb-1">
              Phone <span className="fw-normal text-muted">(optional)</span>
            </label>
            <input id="guest-phone" name="phone" type="tel" className="form-control auth-input" maxLength={20} value={data.phone} onChange={change} disabled={busy} />
          </div>
          <div className="col-12 col-sm-6">
            <label htmlFor="guest-email" className="form-label fw-semibold text-navy small mb-1">
              Email <span className="fw-normal text-muted">(optional, we'll send your tracking ID)</span>
            </label>
            <input id="guest-email" name="email" type="email" className="form-control auth-input" maxLength={200} value={data.email} onChange={change} disabled={busy} />
          </div>
        </div>
      )}

      <p className="text-muted small mb-3">
        <i className="bi bi-paperclip me-1"></i>Want to attach photos or documents?{" "}
        <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onLogin}>Log in</button> first.
      </p>

      {errorBox}

      <button type="submit" className="btn btn-danger w-100 py-2 fw-semibold" disabled={busy}>
        {busy ? "Submitting..." : "Submit complaint"}
      </button>
    </form>
  );
}
