import { resolveApiBase } from "../utils/networkBase";

const base = resolveApiBase(import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "");
const API_BASE = base.endsWith("/api") ? base : `${base}/api`;

export default API_BASE;
