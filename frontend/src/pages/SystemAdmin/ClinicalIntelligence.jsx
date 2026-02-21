import React, { useState } from "react";
import {
  runStaffingForecast,
  runBurnoutScore,
  runCausalImpact,
  runDigitalTwin,
} from "../../services/mlApi";

export default function ClinicalIntelligence() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState("");

  const [forecastInput, setForecastInput] = useState({
    beds: 220,
    occupancyRate: 0.78,
    avgPatientsPerDoctor: 14,
    avgPatientsPerNurse: 5,
    horizonDays: 14,
  });
  const [forecastResult, setForecastResult] = useState(null);

  const [burnoutInput, setBurnoutInput] = useState({
    hoursPerWeek: 52,
    nightShifts: 6,
    consecutiveDays: 7,
    overtimeHours: 12,
    leaveBalanceDays: 8,
    incidentsIn30d: 1,
  });
  const [burnoutResult, setBurnoutResult] = useState(null);

  const [causalInput, setCausalInput] = useState({
    baseline: 100,
    interventionsJson: JSON.stringify(
      [
        { name: "Add ICU nurses", effectPct: 8, confidence: 0.7 },
        { name: "Shift rebalancing", effectPct: 5, confidence: 0.8 },
      ],
      null,
      2
    ),
  });
  const [causalResult, setCausalResult] = useState(null);

  const [twinInput, setTwinInput] = useState({
    departmentsJson: JSON.stringify(
      [
        { name: "ICU", staff: 18, demand: 24, absenteeismRate: 0.08 },
        { name: "Emergency", staff: 26, demand: 30, absenteeismRate: 0.05 },
        { name: "Pediatrics", staff: 15, demand: 12, absenteeismRate: 0.03 },
      ],
      null,
      2
    ),
  });
  const [twinResult, setTwinResult] = useState(null);

  const runForecast = async () => {
    setLoading("forecast");
    setMsg("");
    try {
      const out = await runStaffingForecast(forecastInput);
      setForecastResult(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to run staffing forecast");
    } finally {
      setLoading("");
    }
  };

  const runBurnout = async () => {
    setLoading("burnout");
    setMsg("");
    try {
      const out = await runBurnoutScore(burnoutInput);
      setBurnoutResult(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to run burnout scoring");
    } finally {
      setLoading("");
    }
  };

  const runCausal = async () => {
    setLoading("causal");
    setMsg("");
    try {
      const interventions = JSON.parse(causalInput.interventionsJson || "[]");
      const out = await runCausalImpact({
        baseline: Number(causalInput.baseline || 0),
        interventions,
      });
      setCausalResult(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to run causal impact");
    } finally {
      setLoading("");
    }
  };

  const runTwin = async () => {
    setLoading("twin");
    setMsg("");
    try {
      const departments = JSON.parse(twinInput.departmentsJson || "[]");
      const out = await runDigitalTwin({ departments });
      setTwinResult(out || null);
    } catch (e) {
      setMsg(e?.message || "Failed to run digital twin simulation");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Clinical Intelligence Lab</h2>
          <p className="muted">
            AI staffing planner, burnout risk scoring, causal impact simulation, and hospital digital twin.
          </p>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Staffing Forecast</h3>
        <div className="card">
          <div className="grid info-grid">
            <label>Beds<input type="number" value={forecastInput.beds} onChange={(e) => setForecastInput((p) => ({ ...p, beds: Number(e.target.value || 0) }))} /></label>
            <label>Occupancy Rate<input type="number" step="0.01" value={forecastInput.occupancyRate} onChange={(e) => setForecastInput((p) => ({ ...p, occupancyRate: Number(e.target.value || 0) }))} /></label>
            <label>Patients/Doctor<input type="number" value={forecastInput.avgPatientsPerDoctor} onChange={(e) => setForecastInput((p) => ({ ...p, avgPatientsPerDoctor: Number(e.target.value || 1) }))} /></label>
            <label>Patients/Nurse<input type="number" value={forecastInput.avgPatientsPerNurse} onChange={(e) => setForecastInput((p) => ({ ...p, avgPatientsPerNurse: Number(e.target.value || 1) }))} /></label>
            <label>Horizon Days<input type="number" value={forecastInput.horizonDays} onChange={(e) => setForecastInput((p) => ({ ...p, horizonDays: Number(e.target.value || 1) }))} /></label>
          </div>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={runForecast} disabled={loading === "forecast"}>
              {loading === "forecast" ? "Running..." : "Run Staffing Forecast"}
            </button>
          </div>
          {forecastResult && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(forecastResult, null, 2)}</pre>}
        </div>
      </section>

      <section className="section">
        <h3>Burnout Risk Scoring</h3>
        <div className="card">
          <div className="grid info-grid">
            <label>Hours/Week<input type="number" value={burnoutInput.hoursPerWeek} onChange={(e) => setBurnoutInput((p) => ({ ...p, hoursPerWeek: Number(e.target.value || 0) }))} /></label>
            <label>Night Shifts<input type="number" value={burnoutInput.nightShifts} onChange={(e) => setBurnoutInput((p) => ({ ...p, nightShifts: Number(e.target.value || 0) }))} /></label>
            <label>Consecutive Days<input type="number" value={burnoutInput.consecutiveDays} onChange={(e) => setBurnoutInput((p) => ({ ...p, consecutiveDays: Number(e.target.value || 0) }))} /></label>
            <label>Overtime Hours<input type="number" value={burnoutInput.overtimeHours} onChange={(e) => setBurnoutInput((p) => ({ ...p, overtimeHours: Number(e.target.value || 0) }))} /></label>
            <label>Leave Balance<input type="number" value={burnoutInput.leaveBalanceDays} onChange={(e) => setBurnoutInput((p) => ({ ...p, leaveBalanceDays: Number(e.target.value || 0) }))} /></label>
            <label>Incidents 30d<input type="number" value={burnoutInput.incidentsIn30d} onChange={(e) => setBurnoutInput((p) => ({ ...p, incidentsIn30d: Number(e.target.value || 0) }))} /></label>
          </div>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={runBurnout} disabled={loading === "burnout"}>
              {loading === "burnout" ? "Running..." : "Run Burnout Scoring"}
            </button>
          </div>
          {burnoutResult && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(burnoutResult, null, 2)}</pre>}
        </div>
      </section>

      <section className="section">
        <h3>Causal Impact Simulation</h3>
        <div className="card">
          <label>Baseline Metric<input type="number" value={causalInput.baseline} onChange={(e) => setCausalInput((p) => ({ ...p, baseline: Number(e.target.value || 0) }))} /></label>
          <label>
            Interventions JSON
            <textarea rows={7} value={causalInput.interventionsJson} onChange={(e) => setCausalInput((p) => ({ ...p, interventionsJson: e.target.value }))} />
          </label>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={runCausal} disabled={loading === "causal"}>
              {loading === "causal" ? "Running..." : "Run Causal Simulation"}
            </button>
          </div>
          {causalResult && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(causalResult, null, 2)}</pre>}
        </div>
      </section>

      <section className="section">
        <h3>Digital Twin Simulation</h3>
        <div className="card">
          <label>
            Departments JSON
            <textarea rows={8} value={twinInput.departmentsJson} onChange={(e) => setTwinInput((p) => ({ ...p, departmentsJson: e.target.value }))} />
          </label>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={runTwin} disabled={loading === "twin"}>
              {loading === "twin" ? "Running..." : "Run Digital Twin"}
            </button>
          </div>
          {twinResult && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(twinResult, null, 2)}</pre>}
        </div>
      </section>
    </div>
  );
}

