import React from "react";
import { useNavigate } from "react-router-dom";
import useBeds from "../../hooks/useBeds";

export default function Beds() {
  const navigate = useNavigate();
  const {
    beds,
    hospitals,
    selectedHospitalId,
    setSelectedHospitalId,
    ward,
    setWard,
    number,
    setNumber,
    statusFilter,
    setStatusFilter,
    wardFilter,
    setWardFilter,
    patientQuery,
    setPatientQuery,
    patientOptions,
    assigningBedId,
    setAssigningBedId,
    selectedPatientId,
    setSelectedPatientId,
    transferBedId,
    setTransferBedId,
    targetBedId,
    setTargetBedId,
    dischargeBedId,
    setDischargeBedId,
    dischargeNote,
    setDischargeNote,
    timelineBedId,
    timeline,
    timelineLoading,
    encounterByPatient,
    msg,
    loading,
    saving,
    selectedHospital,
    wardOptions,
    filteredBeds,
    occupancy,
    availableBeds,
    wardSummary,
    tableSectionRef,
    loadHospitals,
    loadBeds,
    toggle,
    searchForPatients,
    assignPatientToBed,
    transferPatientToBed,
    dischargePatientFromBed,
    loadTimeline,
    createNewBed,
  } = useBeds();

  const patientLabel = (patient) => {
    if (!patient) return "No patient assigned";
    const name = [patient.firstName, patient.lastName].filter(Boolean).join(" ");
    return [name || "Unnamed patient", patient.nationalId].filter(Boolean).join(" • ");
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Beds</h2>
          <p className="muted">Manage bed occupancy and patient assignment.</p>
        </div>
      </div>

      <section className="section">
        <div className="card">
          <h3>Bed Scope</h3>
          <label>
            Hospital
            <select value={selectedHospitalId} onChange={(e) => setSelectedHospitalId(e.target.value)}>
              <option value="">Select hospital</option>
              {hospitals.map((h) => (
                <option key={h._id} value={h._id}>{h.name}</option>
              ))}
            </select>
          </label>
          {msg ? <div className="alert-item">{msg}</div> : null}
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Add Bed</h3>
          <form onSubmit={createNewBed} className="grid" style={{ gap: 12 }}>
            <label>Ward<input value={ward} onChange={(e) => setWard(e.target.value)} /></label>
            <label>Bed Number<input value={number} onChange={(e) => setNumber(e.target.value)} /></label>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Bed'}</button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="grid info-grid">
          <div className="card stat"><div className="card-title">Total Beds</div><div className="card-value">{occupancy.total}</div></div>
          <div className="card stat"><div className="card-title">Occupied</div><div className="card-value">{occupancy.occupied}</div></div>
          <div className="card stat"><div className="card-title">Available</div><div className="card-value">{occupancy.available}</div></div>
        </div>
      </section>

      <section className="section">
        <h3>Bed List</h3>
        <div className="grid info-grid">
          {filteredBeds.map((bed) => (
            <div key={bed._id} className="card">
              <div><strong>{bed.ward}</strong> - {bed.number}</div>
              <div className="muted">Hospital: {bed?.hospital?.name || selectedHospital?.name || 'Current hospital'}</div>
              <div>Occupied: {bed.occupied ? 'Yes' : 'No'}</div>
              <div className="muted">Patient: {patientLabel(bed.patient)}</div>
              <div style={{ marginTop: 8 }}>
                <button className="btn-secondary" onClick={() => toggle(bed)}>Toggle</button>
                <button className="btn-secondary" onClick={() => loadTimeline(bed)}>Timeline</button>
              </div>
            </div>
          ))}
          {!loading && !filteredBeds.length ? <div className="card muted">No beds found for this filter.</div> : null}
          {loading ? <div className="card muted">Loading beds...</div> : null}
        </div>
      </section>

      {timelineBedId ? (
        <section className="section">
          <div className="card">
            <div className="card-header-actions">
              <div>
                <h3>Bed Timeline</h3>
                <p className="muted">
                  {timeline?.bed ? `${timeline.bed.ward} - ${timeline.bed.number}` : "Loading bed history"}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setTimelineBedId("");
                  setTimeline({ bed: null, logs: [] });
                }}
              >
                Close
              </button>
            </div>
            {timelineLoading ? <div className="muted">Loading timeline...</div> : null}
            {!timelineLoading && !timeline.logs.length ? (
              <div className="muted">No bed history found.</div>
            ) : null}
            {!timelineLoading && timeline.logs.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {timeline.logs.map((log) => (
                  <div key={log._id} className="alert-item">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>{String(log.action || "").replaceAll("_", " ")}</strong>
                      <span className="muted">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="muted">
                      Actor: {log?.actorId?.name || log?.actorId?.email || log?.actorRole || "System"}
                    </div>
                    {log?.metadata?.patient ? (
                      <div className="muted">Patient: {String(log.metadata.patient)}</div>
                    ) : null}
                    {log?.metadata?.fromWard || log?.metadata?.toWard ? (
                      <div className="muted">
                        Move: {[log?.metadata?.fromWard, log?.metadata?.fromNumber].filter(Boolean).join(" - ")}
                        {" -> "}
                        {[log?.metadata?.toWard, log?.metadata?.toNumber].filter(Boolean).join(" - ")}
                      </div>
                    ) : null}
                    {log?.metadata?.note ? <div>{log.metadata.note}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
