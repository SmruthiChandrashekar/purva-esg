import { useCallback, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthProvider";
import { supabase } from "../services/supabaseClient";
import { apiClient } from "../services/api";
import FileUpload from "../components/FileUpload";
import { saveToQueue } from "../services/offlineQueue";
import ProjectPicker from "../components/ProjectPicker";
import LowPriorityAnswer from "../components/LowPriorityAnswer";
import { initialProject } from "../utils/projectSelection";
import "./Lodge.css";
import FollowupNotice from "../components/FollowupNotice";
import { useFormFollowup } from "../utils/formFollowup";
import { todayLocalISO } from "../utils/dates";
import { apiErrorMessage } from "../utils/apiError";
import { SINGLE_DEPARTMENT_MODE } from "../config/features";

function LodgeExternal() {
  const navigate = useNavigate();
  const location = useLocation();

  // Optional project: pre-selected from ?project= in the link or the last choice in this tab
  const [project, setProject] = useState(() => initialProject(location.search));

  const [submittedId, setSubmittedId] = useState(null);
  // Low-priority result: the policy answer, plus the payload to file it anyway
  const [lowAnswer, setLowAnswer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queryRedirect, setQueryRedirect] = useState(null);
  const { t, langCode } = useLanguage();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    orgName: "",
    contactNumber: "",
    emailAddress: "",
    cityLocation: project?.location || "",
    incidentDate: todayLocalISO(),
    description: location.state?.description || "",
    isAnonymous: false,
    attachments: []
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUploadComplete = (urls) => {
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...urls]
    }));
  };

  const sendToChat = (text) => {
    window.dispatchEvent(new CustomEvent("chatbot-open", { detail: text }));
  };

  // "File it anyway" for a low-priority concern: same complaint, filed at L1
  const fileAnyway = async () => {
    if (!lowAnswer) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient("/submit-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lowAnswer.payload, file_anyway: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(body, res.status));
      setLowAnswer(null);
      setSubmittedId(body.grievance_id || body.id);
    } catch (err) {
      alert(`Failed to submit complaint: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Detail check before filing, like the chat's: missing details are asked in the
  // chatbot popup and the answers added to the description (utils/formFollowup.js)
  const formRef = useRef(null);
  const setDescriptionText = useCallback((text) => setFormData((prev) => ({ ...prev, description: text })), []);
  const followup = useFormFollowup({
    getContext: () => ({
      description: formData.description,
      location: formData.cityLocation,
      date: formData.incidentDate,
      project: project?.name || null,
      lang: langCode,
    }),
    setDescription: setDescriptionText,
    // Complaints handed over from the chat were already checked there
    skip: location.state?.source === "CHATBOT_ESCALATION",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || followup.status === "checking") return;
    if (!(await followup.beforeSubmit())) return;
    setIsSubmitting(true);

    const stripEmojis = (str) =>
      str ? str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').replace(/\s+/g, ' ').trim() : '';
    const cleanDescription = stripEmojis(formData.description);

    const payload = {
      description: cleanDescription,
      attachments: formData.attachments,
      source: location.state?.source || null,
      escalation_token: location.state?.escalation_token || null,
      prefilled_severity: location.state?.severity || null,
      prefilled_department: location.state?.department || null,
      metadata: {
        user_id: formData.isAnonymous ? null : (user?.id || null),
        name: formData.orgName,
        phone: formData.contactNumber,
        email: formData.emailAddress,
        location: formData.cityLocation,
        date: formData.incidentDate,
        department: location.state?.department || "External Relations",
        source: location.state?.source || null,
        severity: location.state?.severity || null,
        prefilled_severity: location.state?.severity || null,
        prefilled_department: location.state?.department || null,
        project: project?.name || null,
        is_anonymous: formData.isAnonymous
      },
    };

    try {
      // ── Submit complaint directly to backend ──────────────────────────────
      // /submit-complaint handles AI classification, routing, and DB storage server-side
      const submitRes = await apiClient("/submit-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!submitRes.ok) {
        const body = await submitRes.json().catch(() => ({}));
        throw new Error(apiErrorMessage(body, submitRes.status));
      }

      const data = await submitRes.json();
      if (data.redirect === "assistant") {
        // Low-priority concern: nothing was filed yet. Show the policy answer here, with
        // "File it anyway" to file the same complaint without retyping it.
        setLowAnswer({ text: data.answer, sources: data.sources || [], payload, prefill: cleanDescription });
        return;
      }
      setSubmittedId(data.grievance_id || data.id);
      return;

    } catch (err) {
      console.error("Grievance submit failed:", err);
      // Queue for later only when the device is offline; otherwise report the real
      // error instead of saving an unrouted stub row straight into Supabase.
      if (!navigator.onLine) {
        try {
          await saveToQueue(payload);
          setSubmittedId("offline-queued");
        } catch (qErr) {
          console.error("Offline queue error:", qErr);
          alert("Failed to submit complaint. Please try again.");
        }
      } else {
        alert(`Failed to submit complaint: ${err.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="container mt-5 mb-5">
      <div className="row justify-content-center">
        <div className="col-md-8">

          <div className="card shadow-lg p-4 border-0 rounded-4">

            {!submittedId ? (
              <>
                <h3 className="mb-4 fw-bold">{t("lodgeExternal")}</h3>

                {lowAnswer && (
                  <LowPriorityAnswer
                    answer={lowAnswer.text}
                    sources={lowAnswer.sources}
                    busy={isSubmitting}
                    onFileAnyway={fileAnyway}
                    onResolved={() => { setLowAnswer(null); navigate("/grm"); }}
                    onAskPurva={() => navigate("/assistant", { state: { prefill: lowAnswer.prefill } })}
                  />
                )}

                {/* Step 1 (optional): which project the complaint is about */}
                {!lowAnswer && (
                <ProjectPicker
                  value={project}
                  onChange={(p) => {
                    setProject(p);
                    if (p?.location) setFormData((prev) => ({ ...prev, cityLocation: prev.cityLocation || p.location }));
                  }}
                />
                )}

                {/* Query / Low / Medium Redirect Banner */}
                {queryRedirect && (
                  <div className={`alert d-flex align-items-start gap-3 mb-4 lodge-redirect-alert is-${queryRedirect.type}`}>
                    <div className="flex-grow-1">
                      <strong>
                        {queryRedirect.type === "low" ? "This looks like a low-priority concern."
                          : queryRedirect.type === "medium" ? "Complaint logged! Policy Assistant is here to help."
                          : "This looks like a general query."}
                      </strong>
                      <p className="mb-1 mt-1 fs-14">
                        {queryRedirect.type === "low"
                          ? "Our Policy Assistant can help resolve this quickly. Check the chatbot in the bottom-right corner."
                          : queryRedirect.type === "medium"
                          ? "Your complaint has been submitted and assigned. The Policy Assistant is open for additional guidance."
                          : "We've redirected you to the Policy Assistant. Check the chatbot in the bottom-right corner for answers."}
                      </p>
                      <button className="btn btn-sm fw-bold fs-12" onClick={() => setQueryRedirect(null)}>Dismiss</button>
                    </div>
                  </div>
                )}

                {user && !SINGLE_DEPARTMENT_MODE && (
                  <div className="alert py-2 mb-4 fs-14 text-theme lodge-filing-note">
                    Filing as: <strong>External Stakeholder</strong>
                  </div>
                )}

                <form ref={formRef} onSubmit={handleSubmit} className={lowAnswer ? "d-none" : undefined}>

                  <div className="mb-3">
                    <label className="fw-semibold mb-1">{t("orgName")}</label>
                    <input type="text" name="orgName" value={formData.orgName} onChange={handleChange} className="form-control" required />
                  </div>

                  <div className="mb-3">
                    <label className="fw-semibold mb-1">{t("contactNumber")}</label>
                    <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="form-control" required />
                  </div>

                  <div className="mb-3">
                    <label className="fw-semibold mb-1">{t("emailAddress")}</label>
                    <input type="email" name="emailAddress" value={formData.emailAddress} onChange={handleChange} className="form-control" />
                  </div>

                  <div className="mb-3">
                    <label className="fw-semibold mb-1">{t("cityLocation")}</label>
                    <input type="text" name="cityLocation" value={formData.cityLocation} onChange={handleChange} className="form-control" required />
                  </div>


                  <div className="mb-3">
                    <label className="fw-semibold mb-1">{t("incidentDate")}</label>
                    <input type="date" name="incidentDate" value={formData.incidentDate} onChange={handleChange} className="form-control" max={todayLocalISO()} required />
                  </div>

                  <div className="mb-3">
                    <label className="fw-semibold mb-1">{t("grievanceDescription")}</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} className="form-control" rows="4" placeholder={t("describeGrievance")} required></textarea>
                  </div>

                  <div className="mb-3">
                    <FileUpload 
                      onUploadComplete={handleUploadComplete} 
                      onUploading={(isUploading) => setIsSubmitting(isUploading)}
                    />
                  </div>

                  <div className="form-check mb-4 mt-3">
                    <input className="form-check-input" type="checkbox" id="anonExternal" name="isAnonymous" checked={formData.isAnonymous} onChange={handleChange} />
                    <label className="form-check-label text-muted" htmlFor="anonExternal">
                      {t("submitAnonymously")}
                    </label>
                  </div>

                  <FollowupNotice
                    status={followup.status}
                    onOpenChat={followup.reopenChat}
                    onFileWithout={() => { followup.fileWithout(); formRef.current?.requestSubmit(); }}
                  />

                  <button type="submit" disabled={isSubmitting || followup.status === "checking"} className="btn btn-danger w-100 py-2 fw-bold shadow-sm">
                    {isSubmitting ? "Submitting..." : t("submitGrievance")}
                  </button>

                </form>
              </>
            ) : submittedId === "offline-queued" ? (
              <div className="text-center py-5">
                <div className="mx-auto mb-4 d-flex justify-content-center align-items-center rounded-circle lodge-result-icon-warn">
                  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                  </svg>
                </div>
                <h3 className="fw-bold mb-3">Saved Offline</h3>
                <p className="text-muted mb-4 fs-6 px-3">
                  Your complaint has been saved locally on this device. It will be <strong>automatically submitted</strong> when your internet connection is restored.
                </p>
                <div className="bg-light p-4 rounded mb-5 d-inline-block border shadow-sm">
                  <span className="text-muted d-block mb-1 text-uppercase fs-14 ls-1">Status</span>
                  <h4 className="fw-bold mb-0 lodge-sync-title">Queued for Sync</h4>
                </div>
                <div className="d-flex justify-content-center gap-3">
                  <button onClick={() => setSubmittedId(null)} className="btn btn-outline-secondary px-4 py-2 fw-bold">
                    {t("submitAnother")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-5">
                <div className="mx-auto mb-4 d-flex justify-content-center align-items-center rounded-circle lodge-result-icon-ok">
                  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="fw-bold mb-3">{t("grievanceSuccess")}</h3>
                <p className="text-muted mb-4 fs-6 px-3">
                  {t("grievanceSuccessMsg")}
                </p>
                <div className="bg-light p-4 rounded mb-4 d-inline-block border shadow-sm text-start" style={{ minWidth: "320px", maxWidth: "480px" }}>
                  <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom">
                    <div>
                      <span className="text-muted d-block mb-1 text-uppercase fs-12 fw-semibold ls-1">Ticket ID</span>
                      <h3 className="fw-bold mb-0 text-danger ls-2">{submittedId}</h3>
                    </div>
                  </div>
                  <p className="text-muted small mb-0">
                    <i className="bi bi-shield-check me-1 text-success"></i>
                    Please save this <strong>Ticket ID</strong>. You can track the complaint with it at any time.
                  </p>
                </div>
                <div className="d-flex justify-content-center gap-3">
                  <button onClick={() => setSubmittedId(null)} className="btn btn-outline-secondary px-4 py-2 fw-bold">
                    {t("submitAnother")}
                  </button>
                  <button onClick={() => navigate("/track", { state: { trackingId: submittedId } })} className="btn btn-danger px-4 py-2 fw-bold shadow-sm">
                    {t("trackStatus")}
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}

export default LodgeExternal;