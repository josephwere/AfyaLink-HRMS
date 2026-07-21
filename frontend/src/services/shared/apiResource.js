import apiFetch from "../../utils/apiFetch";

export function serializeQuery(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}

export function joinPath(base, segment) {
  if (!segment) return base.replace(/\/+$/, "");
  const left = String(base || "").replace(/\/+$/, "");
  const right = String(segment || "").replace(/^\/+/, "");
  return `${left}/${right}`;
}

export function createActionHandler(basePath, actionPath, method = "POST") {
  return async (id, payload) => {
    if (id === undefined || id === null || id === "") {
      throw new Error("Missing resource id for action");
    }
    return apiFetch(`${basePath}/${encodeURIComponent(String(id))}/${actionPath}`, {
      method,
      body: payload,
    });
  };
}
