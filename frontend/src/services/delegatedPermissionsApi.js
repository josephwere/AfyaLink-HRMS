import apiFetch from "../utils/apiFetch";

export async function getDelegationScope(params = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.role) query.set("role", params.role);
  if (params.hospital) query.set("hospital", params.hospital);
  const q = query.toString();
  return apiFetch(`/api/delegated-permissions/scope${q ? `?${q}` : ""}`);
}

export async function getUserDelegatedPermissions(userId) {
  return apiFetch(`/api/delegated-permissions/${userId}`);
}

export async function saveUserDelegatedPermissions(userId, grants) {
  return apiFetch(`/api/delegated-permissions/${userId}`, {
    method: "PUT",
    body: { grants },
  });
}

export async function removeUserDelegatedPermission(userId, permissionKey, action = "VIEW") {
  return apiFetch(`/api/delegated-permissions/${userId}`, {
    method: "DELETE",
    body: { permissionKey, action },
  });
}
