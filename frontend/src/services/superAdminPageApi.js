import apiFetch from "../utils/apiFetch";

export async function listHospitalFeatures(hospitalId) {
  return apiFetch(`/api/hospitals/${hospitalId}/features`);
}

export async function updateHospitalFeatures(hospitalId, features) {
  return apiFetch(`/api/hospitals/${hospitalId}/features`, {
    method: "PUT",
    body: { features },
  });
}

export async function trainMLModel() {
  return apiFetch("/api/ml/train", { method: "POST", body: [{ example: 1 }] });
}

export async function predictMLModel(modelId, input = {}) {
  return apiFetch(`/api/ml/${modelId}/predict`, { method: "POST", body: { input } });
}

export async function listUsers() {
  return apiFetch("/api/users");
}

export async function updateUserRole(userId, role) {
  return apiFetch(`/api/users/${userId}`, { method: "PATCH", body: { role } });
}
