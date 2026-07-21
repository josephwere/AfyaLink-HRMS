import apiFetch from "../utils/apiFetch";

export async function listConnectorAnalytics() {
  return apiFetch("/api/connectors/analytics/list");
}

export async function listConnectors() {
  return apiFetch("/api/connectors");
}

export async function saveConnector(payload) {
  return apiFetch("/api/connectors", {
    method: "POST",
    body: payload,
  });
}

export async function testConnector(connectorId) {
  return apiFetch(`/api/connectors/${connectorId}/test`);
}

export async function testConnectorFhir(connectorId) {
  return apiFetch(`/api/connectors/${connectorId}/test-fhir`);
}

export async function saveConnectorRetryPolicy(connectorId, policy) {
  return apiFetch(`/api/integrations/dlq/connector/${connectorId}/retry-policy`, {
    method: "POST",
    body: policy,
  });
}

export default {
  listConnectorAnalytics,
  listConnectors,
  saveConnector,
  testConnector,
  testConnectorFhir,
  saveConnectorRetryPolicy,
};
