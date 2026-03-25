import apiFetch from "../utils/apiFetch";
import { guardedConsoleFetch } from "./guardedConsoleFetch";

async function loadDeveloperSnapshot(path, warmupKey) {
  const result = await guardedConsoleFetch(path, { warmupKey });
  return result?.payload || null;
}

export const getDeveloperOverview = async () => {
  return loadDeveloperSnapshot("/api/developer/overview", "developer-overview");
};

export const getTrustStatus = async () => {
  return loadDeveloperSnapshot("/api/developer/trust-status", "developer-trust-status");
};

export const runWorkflowSlaScan = async () => {
  return apiFetch("/api/developer/workflow-sla/run", {
    method: "POST",
  });
};

export const getDecisionCockpit = async () => {
  return loadDeveloperSnapshot("/api/developer/decision-cockpit", "developer-decision-cockpit");
};
