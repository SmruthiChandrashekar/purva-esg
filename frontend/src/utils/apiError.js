// Readable message from a FastAPI error body. Validation errors (422) arrive as a
// list like [{ msg: "Value error, Incident date can't be in the future" }].
export const apiErrorMessage = (body, status) => {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => String(d?.msg || d).replace(/^Value error, /, "")).join("; ");
  }
  return `Server error (${status})`;
};
