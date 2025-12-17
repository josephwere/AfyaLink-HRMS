import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      try {
        const r = await api.post("/auth/refresh");
        if (r.data?.accessToken) {
          localStorage.setItem("accessToken", r.data.accessToken);
          original.headers.Authorization = `Bearer ${r.data.accessToken}`;
          return api(original);
        }
      } catch (e) {
        localStorage.removeItem("accessToken");
      }
    }
    return Promise.reject(error);
  }
);
