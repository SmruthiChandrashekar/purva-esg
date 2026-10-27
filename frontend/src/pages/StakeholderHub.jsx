import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { SINGLE_DEPARTMENT_MODE } from "../config/features";
import { findProjectByNameOrId } from "../config/projectsData";
import "./StakeholderHub.css";

const StakeholderHub = () => {
  const { user, userDetails } = useAuth();
  const navigate = useNavigate();

  const [trackInput, setTrackInput] = useState("");
  const [chatInput, setChatInput] = useState("");

  const displayName = userDetails?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Stakeholder";

  const projectParam = new URLSearchParams(window.location.search).get("project") || sessionStorage.getItem("purva_selected_project");
  const activeProjectObj = projectParam ? findProjectByNameOrId(projectParam) : null;

  const getLodgeRoute = () => {
    const projQuery = projectParam ? `?project=${encodeURIComponent(projectParam)}` : "";
    if (SINGLE_DEPARTMENT_MODE) return `/lodge-external${projQuery}`;
    if (!userDetails?.user_type) return `/lodge-selection${projQuery}`;
    switch (userDetails.user_type) {
      case "Internal": return `/lodge-internal${projQuery}`;
      case "Contract": return `/lodge-contract${projQuery}`;
      case "External": return `/lodge-external${projQuery}`;
      default: return `/lodge-selection${projQuery}`;
    }
  };


  const handleTrackSubmit = (e) => {
    e.preventDefault();
    const cleanId = trackInput.trim();
    if (!cleanId) return;
    navigate(`/track?ref=${encodeURIComponent(cleanId)}`);
  };

  const handleChatTrigger = (promptText) => {
    const query = promptText || chatInput;
    if (!query.trim()) return;
    window.dispatchEvent(new CustomEvent("chatbot-open", { detail: query }));
    navigate("/assistant", { state: { prefill: query } });
  };

  const sampleQuestions = [
    "Report noise or dust pollution",
    "Resolution timeline & SLAs",
    "Can I file anonymously?"
  ];

  return (
    <div className="stakeholder-hub">
      {/* ── CLEAN COMPACT HERO BANNER ── */}
      <section className="hub-hero py-4">
        <div className="container">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            <div>
              <h1 className="hub-hero-title mb-1">
                Welcome, {displayName}
              </h1>
              <p className="hub-hero-subtitle mb-0">
                Puravankara Stakeholder Grievance &amp; Complaints Portal.
              </p>
            </div>
            <div>
              <Link to="/dashboard" className="btn hub-btn-dashboard shadow-sm">
                <i className="bi bi-speedometer2 me-2"></i>
                Dashboard &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SIDE-BY-SIDE MAIN CARDS ── */}
      <div className="container py-4">
        <div className="row g-4 align-items-stretch">

          {/* ── LEFT: LODGE A COMPLAINT ── */}
          <div className="col-lg-6 d-flex flex-column">

            {/* CARD 1: LODGE A COMPLAINT */}
            <div className="hub-action-card hub-card-lodge flex-grow-1">
              <div className="hub-card-header mb-3">
                <div className="hub-icon-wrapper hub-icon-inferno">
                  <i className="bi bi-file-earmark-plus"></i>
                </div>
                <div>
                  <h3 className="hub-card-title">Lodge a Complaint</h3>
                  <p className="hub-card-desc mb-0">
                    Report an ESG, site safety, or quality issue.
                  </p>
                </div>
              </div>

              <div className="hub-topics-list mb-3">
                <span className="hub-topic-chip">Environmental</span>
                <span className="hub-topic-chip">Quality</span>
                <span className="hub-topic-chip">Safety</span>
                <span className="hub-topic-chip">Governance</span>
              </div>

              {activeProjectObj ? (
                <div className="hub-project-card p-2 mb-3 rounded-3 bg-white border border-danger-subtle d-flex align-items-center justify-content-between gap-2 shadow-xs">
                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                    <img
                      src={activeProjectObj.image || "/purva_heritage.jpg"}
                      alt={activeProjectObj.name}
                      className="rounded-2 border flex-shrink-0"
                      style={{ width: "52px", height: "46px", objectFit: "cover" }}
                    />
                    <div className="text-truncate">
                      <div className="d-flex align-items-center gap-1 mb-0">
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" style={{ fontSize: "0.68rem", padding: "1px 5px" }}>
                          <i className="bi bi-patch-check-fill me-1"></i>Verified Site
                        </span>
                        {activeProjectObj.city && (
                          <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                            • {activeProjectObj.city}
                          </span>
                        )}
                      </div>
                      <div className="hub-project-name fw-bold text-navy text-truncate" style={{ fontSize: "0.85rem" }}>
                        {activeProjectObj.name}
                      </div>
                      <div className="text-muted text-truncate" style={{ fontSize: "0.74rem" }}>
                        <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                        {activeProjectObj.location}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-2 py-1 text-nowrap rounded-pill"
                    style={{ fontSize: "0.72rem" }}
                    title="Clear selected site"
                    onClick={() => {
                      sessionStorage.removeItem("purva_selected_project");
                      navigate("/grm", { replace: true });
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              <div className="mt-auto pt-2">
                <Link to={getLodgeRoute()} className="btn hub-btn-inferno w-100 py-2">
                  <i className="bi bi-pencil-square me-2"></i>
                  + Lodge Complaint
                </Link>
              </div>
            </div>
          </div>

          {/* ── RIGHT: ASK PURVA (CHATBOT) ── */}
          <div className="col-lg-6">
            <div className="hub-chatbot-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="hub-purva-avatar">
                    <img src="/purva-logo.svg" alt="Purva AI" className="w-100 h-100 object-fit-contain" />
                    <span className="hub-live-dot"></span>
                  </div>
                  <div>
                    <h3 className="hub-card-title mb-0">Ask Purva</h3>
                    <p className="text-muted small mb-0">24/7 ESG AI Policy Assistant</p>
                  </div>
                </div>

                <p className="hub-card-desc mb-3">
                  Instant answers for ESG guidelines, SLAs, and complaint filing.
                </p>

                <div className="mb-3">
                  <label className="text-muted small fw-semibold mb-2 d-block">
                    Quick Questions:
                  </label>
                  <div className="d-flex flex-column gap-2">
                    {sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="hub-question-btn text-start py-2 px-3"
                        onClick={() => handleChatTrigger(q)}
                      >
                        <i className="bi bi-arrow-right-short text-danger me-1"></i>
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* INPUT BAR AT BOTTOM */}
              <div className="pt-3 border-top mt-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleChatTrigger();
                  }}
                  className="mb-2"
                >
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control hub-chat-input"
                      placeholder="Ask Purva anything..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="btn hub-btn-inferno px-3 fw-semibold">
                      Ask &rarr;
                    </button>
                  </div>
                </form>

                <div className="text-end">
                  <Link to="/assistant" className="hub-link-subtle small fw-semibold">
                    Open Fullscreen Assistant &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── BOTTOM: TRACK A COMPLAINT ── */}
          <div className="col-12">
            {/* CARD 2: TRACK A COMPLAINT */}
            <div className="hub-action-card hub-card-track">
              <div className="hub-card-header mb-3">
                <div className="hub-icon-wrapper hub-icon-navy">
                  <i className="bi bi-search"></i>
                </div>
                <div>
                  <h3 className="hub-card-title">Track a Complaint</h3>
                  <p className="hub-card-desc mb-0">
                    Check real-time status and verified resolution proof.
                  </p>
                </div>
              </div>

              {/* INLINE TRACKER */}
              <form onSubmit={handleTrackSubmit} className="mb-3">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control hub-track-input"
                    placeholder="Enter Tracking ID..."
                    value={trackInput}
                    onChange={(e) => setTrackInput(e.target.value)}
                  />
                  <button type="submit" className="btn hub-btn-navy px-3 fw-semibold">
                    Track &rarr;
                  </button>
                </div>
              </form>

              <div className="d-flex justify-content-between align-items-center small pt-1">
                <Link to="/track" className="hub-link-subtle">
                  <i className="bi bi-shield-lock me-1"></i> Track with PIN
                </Link>
                <Link to="/dashboard" className="hub-link-navy fw-semibold">
                  Dashboard History &rarr;
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StakeholderHub;
