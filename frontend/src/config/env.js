import { resolveApiBase } from "../utils/networkBase";

export const API_BASE = resolveApiBase(
  import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || ""
);
