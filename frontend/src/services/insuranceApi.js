import apiFetch from "../utils/apiFetch";

export const approveInsurance = async ({ encounterId, justification }) =>
  apiFetch("/api/insurance/admin/approve", {
    method: "POST",
    body: { encounterId, justification },
  });

export const rejectInsurance = async ({ encounterId, justification }) =>
  apiFetch("/api/insurance/admin/reject", {
    method: "POST",
    body: { encounterId, justification },
  });

export default { approveInsurance, rejectInsurance };
