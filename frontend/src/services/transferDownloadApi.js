import { downloadApiFile } from "../lib/api/client";

export const downloadTransferFhirBundle = (transferId, options = {}) =>
  downloadApiFile(`/api/transfers/${transferId}/fhir`, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });

export const downloadTransferHl7Export = (transferId, options = {}) =>
  downloadApiFile(`/api/transfers/${transferId}/hl7`, {
    ...options,
    headers: { Accept: "text/plain", ...(options.headers || {}) },
  });

export default {
  downloadTransferFhirBundle,
  downloadTransferHl7Export,
};
