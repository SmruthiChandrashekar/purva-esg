import { useEffect, useState } from "react";
import { PURVA_CITIES_PROJECTS, fetchProjectsFromServer } from "../config/projectsData";
import { rememberProject } from "../utils/projectSelection";

/**
 * Optional "which project is this about?" picker, shown first in every complaint form.
 * value: the chosen project object (or null); onChange(project | null).
 */
export default function ProjectPicker({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  // The built-in list shows at once; projects added in the projects table appear when it loads
  const [, setLoadedAt] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchProjectsFromServer().then(() => { if (alive) setLoadedAt(Date.now()); });
    return () => { alive = false; };
  }, []);
  const cities = Object.keys(PURVA_CITIES_PROJECTS);

  const choose = (project) => {
    rememberProject(project?.name || null);
    onChange(project);
    setEditing(false);
  };

  if (value && !editing) {
    return (
      <div className="card border-0 mb-4 shadow-sm lodge-project-card">
        <div className="card-body p-3">
          <div className="small text-muted fw-semibold mb-2">Project</div>
          <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <img
                src={value.image || "/purva_heritage.jpg"}
                alt={value.name}
                className="lodge-project-img rounded-3 shadow-xs"
              />
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  {value.type && <span className="badge bg-navy text-white fs-11">{value.type}</span>}
                  {value.city && <span className="badge bg-light text-muted border fs-11">{value.city}</span>}
                </div>
                <h5 className="fw-bold mb-1 text-navy">{value.name}</h5>
                {value.location && (
                  <p className="text-muted small mb-0">
                    <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                    {value.location}
                  </p>
                )}
              </div>
            </div>
            <div className="d-flex flex-sm-column align-items-end justify-content-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1 fw-semibold fs-12"
                onClick={() => setEditing(true)}
              >
                <i className="bi bi-arrow-repeat me-1"></i> Change
              </button>
              <button
                type="button"
                className="btn btn-link btn-sm text-decoration-none text-muted p-0 fs-12"
                onClick={() => choose(null)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedKey = value ? `${value.city}::${value.id}` : "";

  return (
    <div className="card border mb-4 bg-light shadow-xs rounded-3 lodge-selector-card">
      <div className="card-body p-3">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <label htmlFor="project-picker" className="fw-bold text-navy mb-0">
            <i className="bi bi-building me-2 text-danger"></i>
            Which project is this about? <span className="fw-normal text-muted small">(optional)</span>
          </label>
          {value && (
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0 text-muted small"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          )}
        </div>
        <p className="text-muted small mb-2">
          Pick the Puravankara project or office your complaint relates to, so it reaches the right
          site team. Leave it blank if it isn't about a specific project.
        </p>
        <select
          id="project-picker"
          className="form-select"
          value={selectedKey}
          onChange={(e) => {
            const [city, id] = e.target.value.split("::");
            const project = city ? PURVA_CITIES_PROJECTS[city]?.find((p) => p.id === id) : null;
            choose(project ? { ...project, city } : null);
          }}
        >
          <option value="">No specific project</option>
          {cities.map((city) => (
            <optgroup key={city} label={city}>
              {PURVA_CITIES_PROJECTS[city].map((p) => (
                <option key={p.id} value={`${city}::${p.id}`}>
                  {p.name}{p.location ? ` (${p.location})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
