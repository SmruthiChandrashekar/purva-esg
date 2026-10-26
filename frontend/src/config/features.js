// Testing mode: one department (ESG) and external stakeholders only.
// Users never see departments or stakeholder types. Set VITE_SINGLE_DEPARTMENT_MODE=false
// in frontend/.env to bring the full multi-department UI back.
export const SINGLE_DEPARTMENT_MODE = import.meta.env.VITE_SINGLE_DEPARTMENT_MODE !== "false";
