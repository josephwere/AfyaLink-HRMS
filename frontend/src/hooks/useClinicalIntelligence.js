import { useCallback, useState } from "react";
import { runBurnoutScore, runCausalImpact, runDigitalTwin, runStaffingForecast } from "../services/mlApi";

const defaultForecastInput = {
  beds: 220,
  occupancyRate: 0.78,
  avgPatientsPerDoctor: 14,
  avgPatientsPerNurse: 5,
  horizonDays: 14,
};

const defaultBurnoutInput = {
  hoursPerWeek: 52,
  nightShifts: 6,
  consecutiveDays: 7,
  overtimeHours: 12,
  leaveBalanceDays: 8,
  incidentsIn30d: 1,
};

const defaultCausalInput = {
  baseline: 100,
  interventionsJson: JSON.stringify(
    [
      { name: "Add ICU nurses", effectPct: 8, confidence: 0.7 },
      { name: "Shift rebalancing", effectPct: 5, confidence: 0.8 },
    ],
    null,
    2
  ),
};

const defaultTwinInput = {
  departmentsJson: JSON.stringify(
    [
      { name: "ICU", staff: 18, demand: 24, absenteeismRate: 0.08 },
      { name: "Emergency", staff: 26, demand: 30, absenteeismRate: 0.05 },
      { name: "Pediatrics", staff: 15, demand: 12, absenteeismRate: 0.03 },
    ],
    null,
    2
  ),
};

export function useClinicalIntelligence() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState("");
  const [forecastInput, setForecastInput] = useState(defaultForecastInput);
  const [forecastResult, setForecastResult] = useState(null);
  const [burnoutInput, setBurnoutInput] = useState(defaultBurnoutInput);
  const [burnoutResult, setBurnoutResult] = useState(null);
  const [causalInput, setCausalInput] = useState(defaultCausalInput);
  const [causalResult, setCausalResult] = useState(null);
  const [twinInput, setTwinInput] = useState(defaultTwinInput);
  const [twinResult, setTwinResult] = useState(null);

  const runForecast = useCallback(async () => {
    setLoading("forecast");
    setMsg("");
    try {
      const out = await runStaffingForecast(forecastInput);
      setForecastResult(out || null);
    } catch (err) {
      setMsg(err?.message || "Failed to run staffing forecast");
    } finally {
      setLoading("");
    }
  }, [forecastInput]);

  const runBurnout = useCallback(async () => {
    setLoading("burnout");
    setMsg("");
    try {
      const out = await runBurnoutScore(burnoutInput);
      setBurnoutResult(out || null);
    } catch (err) {
      setMsg(err?.message || "Failed to run burnout scoring");
    } finally {
      setLoading("");
    }
  }, [burnoutInput]);

  const runCausal = useCallback(async () => {
    setLoading("causal");
    setMsg("");
    try {
      const interventions = JSON.parse(causalInput.interventionsJson || "[]");
      const out = await runCausalImpact({
        baseline: Number(causalInput.baseline || 0),
        interventions,
      });
      setCausalResult(out || null);
    } catch (err) {
      setMsg(err?.message || "Failed to run causal impact");
    } finally {
      setLoading("");
    }
  }, [causalInput]);

  const runTwin = useCallback(async () => {
    setLoading("twin");
    setMsg("");
    try {
      const departments = JSON.parse(twinInput.departmentsJson || "[]");
      const out = await runDigitalTwin({ departments });
      setTwinResult(out || null);
    } catch (err) {
      setMsg(err?.message || "Failed to run digital twin simulation");
    } finally {
      setLoading("");
    }
  }, [twinInput]);

  return {
    msg,
    loading,
    forecastInput,
    setForecastInput,
    forecastResult,
    burnoutInput,
    setBurnoutInput,
    burnoutResult,
    causalInput,
    setCausalInput,
    causalResult,
    twinInput,
    setTwinInput,
    twinResult,
    runForecast,
    runBurnout,
    runCausal,
    runTwin,
  };
}

export default useClinicalIntelligence;
