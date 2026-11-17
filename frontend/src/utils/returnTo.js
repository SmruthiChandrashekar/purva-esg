// After logging in, people go back to the page they were trying to open
// (/login?next=/lodge-external?project=...). Only pages on this same site are accepted,
// so a crafted link can't send someone to another site after they log in.
export function nextFromLocation(search = window.location.search) {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/")) return null;
  // Browsers drop tabs/newlines and treat "\" like "/" in URLs, so "/\t/evil.com" or
  // "/\evil.com" would become "//evil.com". Reject them outright, then let the URL
  // parser confirm the result stays on this site.
  const hasControlChar = [...next].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
  if (hasControlChar || /[\s\\]/.test(next)) return null;
  let url;
  try {
    url = new URL(next, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (/^\/(login|register|auth)(\/|$)/.test(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}
