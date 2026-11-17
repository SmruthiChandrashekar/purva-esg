// After logging in, people go back to the page they were trying to open
// (/login?next=/lodge-external?project=...). Only paths inside this app are
// accepted, so a crafted link can't send someone to another site.
export function nextFromLocation(search = window.location.search) {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login") || next.startsWith("/register") || next.startsWith("/auth")) return null;
  return next;
}
