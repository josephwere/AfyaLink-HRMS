import api from "./api";

export const getDeveloperOverview = async () => {
  const res = await api.get("/api/developer/overview");
  return res.data;
};

export const getTrustStatus = async () => {
  const res = await api.get("/api/developer/trust-status");
  return res.data;
};

export const runWorkflowSlaScan = async () => {
  const res = await api.post("/api/developer/workflow-sla/run");
  return res.data;
};

export const getDecisionCockpit = async () => {
  const res = await api.get("/api/developer/decision-cockpit");
  return res.data;
};
