/**
 * Shown above a complaint form's Submit button while the detail check runs
 * (see utils/formFollowup.js).
 */
export default function FollowupNotice({ status, onOpenChat, onFileWithout }) {
  if (status === "checking") {
    return (
      <div className="alert alert-light border small d-flex align-items-center gap-2 mb-3" role="status">
        <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
        Checking your complaint has the details the team needs...
      </div>
    );
  }
  if (status === "asking") {
    return (
      <div className="alert alert-warning small mb-3" role="status">
        <div className="fw-semibold mb-1">
          <i className="bi bi-chat-dots me-1"></i>A little more detail is needed before this is filed.
        </div>
        <div className="mb-2">
          Please answer the question in the chat window. Your answer is added to the description below.
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm btn-warning fw-semibold" onClick={onOpenChat}>
            Open the chat
          </button>
          <button type="button" className="btn btn-sm btn-link text-decoration-none p-0" onClick={onFileWithout}>
            Submit without these details
          </button>
        </div>
      </div>
    );
  }
  if (status === "ready") {
    return (
      <div className="alert alert-success small mb-3" role="status">
        <i className="bi bi-check-circle me-1"></i>
        Your answers were added to the description. Please review it, then press Submit.
      </div>
    );
  }
  return null;
}
