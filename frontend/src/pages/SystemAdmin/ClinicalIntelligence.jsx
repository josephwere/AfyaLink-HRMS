import React from "react";
import { useClinicalIntelligence } from "../../hooks/useClinicalIntelligence";

export default function ClinicalIntelligence() {
  const {
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
  } = useClinicalIntelligence();

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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={runForecast} disabled={loading === "forecast"}>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={runBurnout} disabled={loading === "burnout"}>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={runCausal} disabled={loading === "causal"}>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={runTwin} disabled={loading === "twin"}>
              {loading === "twin" ? "Running..." : "Run Digital Twin"}
            </button>
          </div>
          {twinResult && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(twinResult, null, 2)}</pre>}
        </div>
      </section>
    </div>
  );
}

