import { useCallback, useState } from "react";
import { approveInsurance, rejectInsurance } from "../services/insuranceApi";

export function useAdminInsuranceActions(encounter) {
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const allowed = (encounter?.workflow?.allowedTransitions) || [];
  const canApprove = allowed.includes("INSURANCE_APPROVED");
  const canReject = allowed.includes("INSURANCE_REJECTED");

  const approve = useCallback(async () => {
    if (!justification.trim()) {
      setMsg("Justification is required");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await approveInsurance({ encounterId: encounter._id, justification });
      setMsg("✅ Insurance approved successfully");
    } catch (err) {
      setMsg(err?.message || "Unable to approve insurance.");
    } finally {
      setLoading(false);
    }
  }, [justification, encounter]);

  const reject = useCallback(async () => {
    if (!justification.trim()) {
      setMsg("Justification is required");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await rejectInsurance({ encounterId: encounter._id, justification });
      setMsg("❌ Insurance rejected");
    } catch (err) {
      setMsg(err?.message || "Unable to reject insurance.");
    } finally {
      setLoading(false);
    }
  }, [justification, encounter]);

  return {
    justification,
    setJustification,
    loading,
    msg,
    canApprove,
    canReject,
    approve,
    reject,
  };
}

export default useAdminInsuranceActions;
