import api from "./api";

export async function getDelegationScope(params = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.role) query.set("role", params.role);
  if (params.hospital) query.set("hospital", params.hospital);
  const q = query.toString();
  const res = await api.get(`/api/delegated-permissions/scope${q ? `?${q}` : ""}`);
  return res.data;
}

export async function getUserDelegatedPermissions(userId) {
  const res = await api.get(`/api/delegated-permissions/${userId}`);
  return res.data;
}

export async function saveUserDelegatedPermissions(userId, grants) {
  const res = await api.put(`/api/delegated-permissions/${userId}`, { grants });
  return res.data;
}

export async function removeUserDelegatedPermission(userId, permissionKey, action = "VIEW") {
  const base = import.meta.env.VITE_API_URL || "";
  const token = localStorage.getItem("token");
  const res = await fetch(`${base}/api/delegated-permissions/${userId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ permissionKey, action }),
  });
  return res.json();
}

