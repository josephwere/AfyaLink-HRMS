import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDecisionCockpit } from "../services/developerApi";

const severityTone = (severity) => {
  const value = String(severity || "").toUpperCase();
  if (["CRITICAL", "HIGH"].includes(value)) return "risk";
  if (["MEDIUM", "WARN"].includes(value)) return "warn";
  return "good";
};

export function useDecisionCockpit() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const anomaliesSectionRef = useRef(null);
  const recommendationsSectionRef = useRef(null);

  const scrollToSection = useCallback((ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const load = useCallback(async () => {
    setMsg("");
    try {
      const out = await getDecisionCockpit();
      setData(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to load decision cockpit");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const anomalyCount = data?.anomalies?.length || 0;
  const recommendationCount = data?.recommendations?.length || 0;
  const riskAnomalyCount = (data?.anomalies || []).filter((item) => severityTone(item.severity) === "risk").length;

  const trustCards = useMemo(
    () => [
      { title: "Ledger Writes (24h)", value: data?.trust?.ledgerWrites24h ?? "—", subtitle: "Compliance proofs written" },
      { title: "Policy Denials (24h)", value: data?.trust?.policyDenials24h ?? "—", subtitle: "Rules blocked by policy", status: Number(data?.trust?.policyDenials24h || 0) > 0 ? "warn" : "good" },
      { title: "Consent Denials (24h)", value: data?.trust?.consentDenials24h ?? "—", subtitle: "Exports rejected for consent", status: Number(data?.trust?.consentDenials24h || 0) > 0 ? "risk" : "good" },
      { title: "Risk Step-Ups (24h)", value: data?.trust?.highRiskStepUps24h ?? "—", subtitle: "Access friction spikes", status: Number(data?.trust?.highRiskStepUps24h || 0) > 0 ? "warn" : "good" },
    ],
    [data]
  );

  return {
    data,
    msg,
    anomaliesSectionRef,
    recommendationsSectionRef,
    scrollToSection,
    load,
    anomalyCount,
    recommendationCount,
    riskAnomalyCount,
    trustCards,
    severityTone,
  };
}

export default useDecisionCockpit;
