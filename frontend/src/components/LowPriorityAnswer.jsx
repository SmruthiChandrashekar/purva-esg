/**
 * Shown instead of the form when the AI rates a complaint as low priority: nothing is
 * filed yet. The person reads the policy answer and either stops there or files the same
 * complaint anyway, without retyping it.
 */
export default function LowPriorityAnswer({ answer, sources = [], busy, onFileAnyway, onResolved, onAskPurva }) {
  return (
    <div className="mb-2">
      <h4 className="fw-bold text-navy mb-2">This may already be answered</h4>
      <p className="text-muted small mb-3">
        Our assistant rated this a low-priority concern, so it hasn't been filed yet. Here's what
        the Puravankara policies say:
      </p>
      <div className="border rounded-3 p-3 mb-3 bg-light small" style={{ whiteSpace: "pre-wrap" }}>
        {answer || "No policy answer is available right now."}
        {sources.length > 0 && (
          <div className="text-muted mt-2"><strong>Sources:</strong> {sources.join(", ")}</div>
        )}
      </div>
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-outline-secondary fw-semibold" disabled={busy} onClick={onResolved}>
          That answers it
        </button>
        <button type="button" className="btn btn-danger fw-semibold" disabled={busy} onClick={onFileAnyway}>
          {busy ? "Filing..." : "File it anyway"}
        </button>
      </div>
      <p className="text-muted small mt-2 mb-0">
        "File it anyway" files the complaint you wrote; you don't need to type it again.
        {onAskPurva && (
          <>
            {" "}Or{" "}
            <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onAskPurva}>
              ask Purva a follow-up question
            </button>.
          </>
        )}
      </p>
    </div>
  );
}
