import { apiFetch } from "../utils/apiFetch";

export const getPrintingConnectors = (hospitalId = "") =>
  apiFetch(`/api/printing/connectors${hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : ""}`);

export const listPrinterProfiles = (hospitalId = "") =>
  apiFetch(`/api/printing/profiles${hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : ""}`);

export const createPrinterProfile = (payload) =>
  apiFetch("/api/printing/profiles", { method: "POST", body: payload });

export const updatePrinterProfile = (id, payload) =>
  apiFetch(`/api/printing/profiles/${id}`, { method: "PATCH", body: payload });

export const listPrintJobs = (params = {}) => {
  const q = new URLSearchParams();
  if (params.hospitalId) q.set("hospitalId", params.hospitalId);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch(`/api/printing/jobs${qs ? `?${qs}` : ""}`);
};

export const queuePrintJob = (payload) =>
  apiFetch("/api/printing/jobs", { method: "POST", body: payload });

export const updatePrintJobStatus = (id, payload) =>
  apiFetch(`/api/printing/jobs/${id}/status`, { method: "PATCH", body: payload });

export function printHtmlDocument(html, title = "AfyaLink Print") {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) throw new Error("Popup blocked. Allow popups to print.");
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.document.title = title;
  popup.focus();
  popup.print();
}

