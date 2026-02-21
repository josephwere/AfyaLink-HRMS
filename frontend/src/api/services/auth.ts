import { api } from "../client";
import { LoginRequest, LoginResponse } from "../schemas/auth";

export async function login(payload) {
  const parsedReq = LoginRequest.safeParse(payload);
  if (!parsedReq.success) {
    console.warn("Login payload mismatch", parsedReq.error);
    throw new Error("Invalid login payload");
  }

  const res = await api.post("/auth/login", parsedReq.data);
  const parsedRes = LoginResponse.safeParse(res.data);

  if (parsedRes.success && parsedRes.data.accessToken) {
    localStorage.setItem("accessToken", parsedRes.data.accessToken);
  } else {
    console.warn("Login response shape differs, continuing safely");
  }

  return res.data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    localStorage.removeItem("accessToken");
  }
}
