// After a new deploy, the page's code files get new names and the old ones are deleted.
// A tab opened before the deploy then fails to load the next page ("Failed to fetch
// dynamically imported module") and the user saw "Application Error". Reloading once
// loads the new version. The time guard stops a reload loop if the failure is real
// (e.g. the server is down): the normal error screen is shown instead.

const KEY = "grm_new_version_reload_at";
const GUARD_MS = 30000;

export function isNewVersionError(error) {
  const text = String(error?.message || error || "");
  // Chrome, Safari (two wordings, incl. getting HTML back instead of code), Firefox, Vite CSS
  return /Failed to fetch dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Expected a JavaScript module script|error loading dynamically imported module|Unable to preload CSS|Loading chunk \S+ failed/i.test(text);
}

/** Reloads the page once. Returns false (and does nothing) if it already tried just now. */
export function reloadOnceForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode): without a guard, don't risk a loop
    return false;
  }
  window.location.reload();
  return true;
}
