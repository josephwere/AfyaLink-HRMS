import apiFetch from "../utils/apiFetch";

export const getDeveloperOverview = async () => {
  return apiFetch("/api/developer/overview");
};

export const getTrustStatus = async () => {
  return apiFetch("/api/developer/trust-status");
};

export const runWorkflowSlaScan = async () => {
  return apiFetch("/api/developer/workflow-sla/run", {
    method: "POST",
  });
};

export const getDecisionCockpit = async () => {
  return apiFetch("/api/developer/decision-cockpit");
};
