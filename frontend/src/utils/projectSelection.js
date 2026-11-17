import { findProjectByNameOrId } from "../config/projectsData";

const STORAGE_KEY = "purva_selected_project";

export function rememberProject(name) {
  try {
    if (name) sessionStorage.setItem(STORAGE_KEY, name);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode / blocked storage: the picker still works for this page
  }
}

/**
 * Project to start the form with: ?project=<id or name> in the link (e.g. a site QR code),
 * otherwise the project last chosen in this browser tab. Returns null when there is none.
 */
export function initialProject(search) {
  let id = new URLSearchParams(search).get("project");
  if (id) rememberProject(id);
  if (!id) {
    try { id = sessionStorage.getItem(STORAGE_KEY); } catch { id = null; }
  }
  return id ? findProjectByNameOrId(id) : null;
}

