import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth.jsx";
import { listHospitals } from "../../services/superAdminApi";
import { useNavigate } from "react-router-dom";

export default function Beds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = String(user?.role || "").toUpperCase();
  const isGlobalRole = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
  const isWardOperator = role === "NURSE";
  const isDoctorViewer = role === "DOCTOR";
  const canCreateBeds = !isWardOperator && !isDoctorViewer;
  const canMovePatients = ["NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role);
  const actorHospitalId = user?.hospitalId || user?.hospital || "";

  const [beds, setBeds] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(actorHospitalId || "");
  const [ward, setWard] = useState("");
  const [number, setNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [wardFilter, setWardFilter] = useState("ALL");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOptions, setPatientOptions] = useState([]);
  const [assigningBedId, setAssigningBedId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [transferBedId, setTransferBedId] = useState("");
  const [targetBedId, setTargetBedId] = useState("");
  const [dischargeBedId, setDischargeBedId] = useState("");
  const [dischargeNote, setDischargeNote] = useState("");
  const [timelineBedId, setTimelineBedId] = useState("");
  const [timeline, setTimeline] = useState({ bed: null, logs: [] });
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedHospital = useMemo(
    () => hospitals.find((row) => String(row._id) === String(selectedHospitalId)) || null,
    [hospitals, selectedHospitalId]
  );
  const wardOptions = useMemo(
    () => [...new Set(beds.map((row) => row.ward).filter(Boolean))].sort(),
    [beds]
  );
  const filteredBeds = useMemo(() => {
    return beds.filter((bed) => {
      if (statusFilter === "OCCUPIED" && !bed.occupied) return false;
      if (statusFilter === "AVAILABLE" && bed.occupied) return false;
      if (wardFilter !== "ALL" && bed.ward !== wardFilter) return false;
      return true;
    });
  }, [beds, statusFilter, wardFilter]);
  const occupancy = useMemo(() => {
    const total = beds.length;
    const occupied = beds.filter((row) => row.occupied).length;
    return {
      total,
      occupied,
      available: Math.max(0, total - occupied),
      occupancyRate: total ? Math.round((occupied / total) * 100) : 0,
    };
  }, [beds]);
  const availableBeds = useMemo(
    () => beds.filter((row) => !row.occupied),
    [beds]
  );
  const wardSummary = useMemo(() => {
    const map = new Map();
    for (const bed of beds) {
      const key = bed.ward || "Unassigned";
      const current = map.get(key) || { ward: key, total: 0, occupied: 0 };
      current.total += 1;
      if (bed.occupied) current.occupied += 1;
      map.set(key, current);
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        available: Math.max(0, row.total - row.occupied),
        occupancyRate: row.total ? Math.round((row.occupied / row.total) * 100) : 0,
      }))
      .sort((a, b) => a.ward.localeCompare(b.ward));
  }, [beds]);

  function patientLabel(patient) {
    if (!patient) return "No patient assigned";
    const name = [patient.firstName, patient.lastName].filter(Boolean).join(" ");
    return [name || "Unnamed patient", patient.nationalId].filter(Boolean).join(" • ");
  }

  function openClinicalContext(patientId, mode) {
    if (!patientId) return;
    if (role === "DOCTOR") {
      if (mode === "record") navigate(`/doctor/medical-records?patientId=${patientId}`);
      else if (mode === "notes") navigate(`/doctor/reports-notes?patientId=${patientId}`);
      else if (mode === "prescribe") navigate(`/doctor/prescriptions?patientId=${patientId}`);
      else navigate(`/doctor/opd?patientId=${patientId}`);
      return;
    }
    if (role === "NURSE") {
      if (mode === "vitals") navigate(`/nurse/vitals?patientId=${patientId}`);
      else navigate(`/nurse/patients?patientId=${patientId}`);
      return;
    }
    navigate(`/profile`);
  }

  async function loadHospitals() {
    if (!isGlobalRole) return;
    try {
      const data = await listHospitals({ limit: 200, active: true });
      const rows = Array.isArray(data?.items) ? data.items : [];
      setHospitals(rows);
      if (!selectedHospitalId && rows[0]?._id) {
        setSelectedHospitalId(String(rows[0]._id));
      }
    } catch (e) {
      setHospitals([]);
      setMsg(e?.message || "Failed to load hospitals");
    }
  }

  async function loadBeds(hospitalId = selectedHospitalId || actorHospitalId) {
    setLoading(true);
    setMsg("");
    try {
      const query = isGlobalRole && hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
      const js = await apiFetch(`/api/beds${query}`);
      const rows = Array.isArray(js) ? js : Array.isArray(js?.data) ? js.data : [];
      setBeds(rows);
      if (isDoctorViewer) {
        const patientIds = [...new Set(rows.map((row) => String(row?.patient?._id || "")).filter(Boolean))];
        if (!patientIds.length) {
          setEncounterByPatient({});
        } else {
          const pairs = await Promise.all(
            patientIds.map(async (patientId) => {
              try {
                const encounterRows = await apiFetch(`/api/encounters?patientId=${encodeURIComponent(patientId)}&limit=1`);
                const items = Array.isArray(encounterRows) ? encounterRows : [];
                return [patientId, items[0] || null];
              } catch {
                return [patientId, null];
              }
            })
          );
          setEncounterByPatient(Object.fromEntries(pairs));
        }
      } else {
        setEncounterByPatient({});
      }
    } catch (e) {
      setMsg(e?.message || "Failed to load beds");
      setBeds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isGlobalRole) {
      loadHospitals();
    }
  }, [isGlobalRole]);

  useEffect(() => {
    if (isGlobalRole) {
      if (selectedHospitalId) loadBeds(selectedHospitalId);
      else setBeds([]);
      return;
    }
    if (actorHospitalId) loadBeds(actorHospitalId);
  }, [isGlobalRole, selectedHospitalId, actorHospitalId]);

  async function toggle(bed) {
    try {
      if (bed.occupied) {
        const proceed = window.confirm(
          `Release ${patientLabel(bed.patient)} from bed ${bed.number}?`
        );
        if (!proceed) return;
      }
      const payload = {
        occupied: !bed.occupied,
        patient: bed.occupied ? null : bed.patient?._id || null,
      };
      if (isGlobalRole && selectedHospitalId) {
        payload.hospitalId = selectedHospitalId;
      }
      await apiFetch(`/api/beds/${bed._id}`, {
        method: "PUT",
        body: payload,
      });
      setMsg(`Bed ${bed.number} updated`);
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) {
      setMsg(e?.message || "Failed to update bed");
    }
  }

  async function searchPatients(query) {
    const targetHospitalId = selectedHospitalId || actorHospitalId;
    if (!targetHospitalId || !query.trim()) {
      setPatientOptions([]);
      return;
    }
    try {
      const qs = new URLSearchParams({ q: query.trim() });
      if (isGlobalRole) qs.set("hospitalId", String(targetHospitalId));
      const rows = await apiFetch(`/api/patients/search?${qs.toString()}`);
      setPatientOptions(Array.isArray(rows) ? rows : []);
    } catch {
      setPatientOptions([]);
    }
  }

  async function assignPatientToBed(bed) {
    if (!selectedPatientId) {
      setMsg("Pick a patient first");
      return;
    }
    try {
      const payload = {
        occupied: true,
        patient: selectedPatientId,
      };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await apiFetch(`/api/beds/${bed._id}`, {
        method: "PUT",
        body: payload,
      });
      setMsg(`Patient assigned to bed ${bed.number}`);
      setAssigningBedId("");
      setSelectedPatientId("");
      setPatientQuery("");
      setPatientOptions([]);
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) {
      setMsg(e?.message || "Failed to assign patient");
    }
  }

  async function transferPatient(bed) {
    if (!targetBedId) {
      setMsg("Pick a target bed first");
      return;
    }
    try {
      const payload = { targetBedId };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await apiFetch(`/api/beds/${bed._id}/transfer`, {
        method: "POST",
        body: payload,
      });
      setMsg(`Patient moved from bed ${bed.number}`);
      setTransferBedId("");
      setTargetBedId("");
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) {
      setMsg(e?.message || "Failed to transfer patient");
    }
  }

  async function dischargePatient(bed) {
    try {
      const payload = { note: dischargeNote };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await apiFetch(`/api/beds/${bed._id}/discharge`, {
        method: "POST",
        body: payload,
      });
      setMsg(`Patient discharged from bed ${bed.number}`);
      setDischargeBedId("");
      setDischargeNote("");
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) {
      setMsg(e?.message || "Failed to discharge patient");
    }
  }

  async function loadTimeline(bed) {
    try {
      setTimelineLoading(true);
      setTimelineBedId(bed._id);
      const query = isGlobalRole && selectedHospitalId
        ? `?hospitalId=${encodeURIComponent(selectedHospitalId)}`
        : "";
      const js = await apiFetch(`/api/beds/${bed._id}/timeline${query}`);
      setTimeline(js?.data || { bed: null, logs: [] });
    } catch (e) {
      setMsg(e?.message || "Failed to load bed timeline");
      setTimeline({ bed: null, logs: [] });
      setTimelineBedId("");
    } finally {
      setTimelineLoading(false);
    }
  }

  async function createBed(event) {
    event.preventDefault();
    if (!ward.trim() || !number.trim()) {
      setMsg("Ward and bed number are required");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        ward: ward.trim(),
        number: number.trim(),
      };
      if (isGlobalRole && selectedHospitalId) {
        payload.hospitalId = selectedHospitalId;
      }
      await apiFetch("/api/beds", {
        method: "POST",
        body: payload,
      });
      setWard("");
      setNumber("");
      setMsg("Bed created");
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) {
      setMsg(e?.message || "Failed to create bed");
    } finally {
      setSaving(false);
    }
  }

  function closeoutLabel(encounter) {
    if (!encounter?._id) return "No visit";
    if (encounter?.closeout?.canClose) return "Ready to close";
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Pending: ${missing}` : "Requirements pending";
  }
  function firstMissingRequirement(encounter) {
    const items = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements
      : [];
    return items[0] || "";
  }

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>{isWardOperator ? "Ward Board" : isDoctorViewer ? "Inpatient Ward Board" : "Beds"}</h2>
          <p className="muted">
            {isDoctorViewer
              ? "Live inpatient occupancy, recent movement, and bed timelines for clinical follow-up."
              : isWardOperator
              ? "Live ward occupancy, patient moves, and discharge actions for your hospital."
              : "Manage bed occupancy with strict hospital scope."}
          </p>
        </div>
      </div>

      <section className="section doctor-main-grid">
        <div className="card doctor-alerts-card">
          <h3>Bed Scope</h3>
          {isGlobalRole ? (
            <label>
              Hospital
              <select
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                data-ai-label="Hospital"
                data-ai-aliases="facility|site|bed scope hospital"
                data-ai-widget="hospital-scope-selector"
              >
                <option value="">Select hospital</option>
                {hospitals.map((hospital) => (
                  <option key={hospital._id} value={hospital._id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted">Beds are scoped to your hospital automatically.</p>
          )}
          {selectedHospital ? (
            <p className="muted">Showing beds for {selectedHospital.name}.</p>
          ) : null}
          {msg ? <div className="alert-item">{msg}</div> : null}
        </div>

        {canCreateBeds ? (
          <div className="card doctor-schedule-card">
            <h3>Add Bed</h3>
            <form className="grid" style={{ gap: 12 }} onSubmit={createBed}>
              <label>
                Ward
                <input
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  placeholder="Ward A"
                  data-ai-label="Ward"
                  data-ai-aliases="unit|ward name|inpatient ward"
                />
              </label>
              <label>
                Bed Number
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="A-01"
                  data-ai-label="Bed Number"
                  data-ai-aliases="bed|bed assignment|bed code"
                />
              </label>
              <button type="submit" className="btn-primary" disabled={saving || (isGlobalRole && !selectedHospitalId)}>
                {saving ? "Saving..." : "Add Bed"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card doctor-schedule-card">
            <h3>{isDoctorViewer ? "Clinical Ward View" : "Ward Actions"}</h3>
            <div className="panel-grid">
              {isDoctorViewer ? (
                <>
                  <div className="action-pill">Review occupancy by ward and patient</div>
                  <div className="action-pill">Open movement timelines before clinical decisions</div>
                  <div className="action-pill">Coordinate transfers and discharges with nurses/admins</div>
                </>
              ) : (
                <>
                  <div className="action-pill">Assign patients to open beds</div>
                  <div className="action-pill">Transfer occupied beds safely</div>
                  <div className="action-pill">Discharge only after encounter closure</div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <div className="grid info-grid">
          <div className="card stat">
            <div className="card-title">Total Beds</div>
            <div className="card-value">{occupancy.total}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Occupied</div>
            <div className="card-value">{occupancy.occupied}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Available</div>
            <div className="card-value">{occupancy.available}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Occupancy</div>
            <div className="card-value">{occupancy.occupancyRate}%</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Ward Summary</h3>
        <div className="grid info-grid">
          {wardSummary.map((row) => (
            <div key={row.ward} className="card stat">
              <div className="card-title">{row.ward}</div>
              <div className="card-value">{row.occupied}/{row.total}</div>
              <div className="card-sub">{row.available} available • {row.occupancyRate}% occupied</div>
            </div>
          ))}
          {!wardSummary.length ? <div className="card muted">No ward summary available.</div> : null}
        </div>
      </section>

      <section className="section">
        <div className="card card-header-actions" style={{ marginBottom: 12 }}>
          <h3>Filters</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-ai-label="Bed Status Filter"
              data-ai-aliases="status filter|occupancy filter"
              data-ai-intent="filter"
              data-ai-priority="low"
            >
              <option value="ALL">All beds</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
            </select>
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              data-ai-label="Ward Filter"
              data-ai-aliases="ward filter|unit filter"
              data-ai-intent="filter"
              data-ai-priority="low"
            >
              <option value="ALL">All wards</option>
              {wardOptions.map((wardName) => (
                <option key={wardName} value={wardName}>{wardName}</option>
              ))}
            </select>
          </div>
        </div>
        <h3>Bed List</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
          {filteredBeds.map((bed) => (
            <div key={bed._id} className="card">
              <div><strong>{bed.ward}</strong> - {bed.number}</div>
              <div className="muted">
                Hospital: {bed?.hospital?.name || selectedHospital?.name || "Current hospital"}
              </div>
              <div>Occupied: {bed.occupied ? "Yes" : "No"}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Patient: {patientLabel(bed.patient)}
              </div>
              {isDoctorViewer && bed?.patient?._id ? (
                <button
                  type="button"
                  className="action-pill"
                  style={{ marginTop: 8, cursor: "pointer" }}
                  onClick={() =>
                    navigate(
                      `/doctor/opd?patientId=${encodeURIComponent(String(bed.patient._id))}${
                        firstMissingRequirement(encounterByPatient[String(bed.patient._id)])
                          ? `&focus=${encodeURIComponent(firstMissingRequirement(encounterByPatient[String(bed.patient._id)]))}`
                          : ""
                      }`
                    )
                  }
                >
                  {closeoutLabel(encounterByPatient[String(bed.patient._id)])}
                </button>
              ) : null}
              {bed.occupied ? (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {bed?.patient?._id && (isDoctorViewer || isWardOperator) ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isDoctorViewer ? (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openClinicalContext(bed.patient._id, "record")}
                          >
                            Open Record
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openClinicalContext(bed.patient._id, "notes")}
                          >
                            Add Note
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openClinicalContext(bed.patient._id, "prescribe")}
                          >
                            Prescribe
                          </button>
                        </>
                      ) : null}
                      {isWardOperator ? (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openClinicalContext(bed.patient._id, "patient")}
                          >
                            Patient Tasks
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openClinicalContext(bed.patient._id, "vitals")}
                          >
                            Record Vitals
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {canMovePatients ? (
                      <>
                        <button type="button" className="btn-secondary" onClick={() => toggle(bed)}>
                          Free
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setTransferBedId(transferBedId === bed._id ? "" : bed._id);
                            setTargetBedId("");
                            setDischargeBedId("");
                          }}
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setDischargeBedId(dischargeBedId === bed._id ? "" : bed._id);
                            setTransferBedId("");
                            setDischargeNote("");
                          }}
                        >
                          Discharge
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (timelineBedId === bed._id) {
                          setTimelineBedId("");
                          setTimeline({ bed: null, logs: [] });
                          return;
                        }
                        loadTimeline(bed);
                      }}
                    >
                      Timeline
                    </button>
                  </div>
                  {transferBedId === bed._id ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <select
                        value={targetBedId}
                        onChange={(e) => setTargetBedId(e.target.value)}
                        data-ai-label="Target Bed"
                        data-ai-aliases="transfer bed|destination bed|new bed"
                        data-ai-widget="bed-selector"
                      >
                        <option value="">Select target bed</option>
                        {availableBeds
                          .filter((row) => row._id !== bed._id)
                          .map((row) => (
                            <option key={row._id} value={row._id}>
                              {row.ward} - {row.number}
                            </option>
                          ))}
                      </select>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn-primary" onClick={() => transferPatient(bed)}>
                          Confirm Transfer
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => { setTransferBedId(""); setTargetBedId(""); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {dischargeBedId === bed._id ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <textarea
                        rows={3}
                        value={dischargeNote}
                        onChange={(e) => setDischargeNote(e.target.value)}
                        placeholder="Discharge note"
                        data-ai-label="Discharge Note"
                        data-ai-aliases="discharge summary|release note|disposition note"
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn-primary" onClick={() => dischargePatient(bed)}>
                          Confirm Discharge
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => { setDischargeBedId(""); setDischargeNote(""); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  {canMovePatients ? (
                    assigningBedId === bed._id ? (
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        <input
                          value={patientQuery}
                          onChange={(e) => {
                            const next = e.target.value;
                            setPatientQuery(next);
                            searchPatients(next);
                          }}
                          placeholder="Search patient"
                          data-ai-label="Patient Search"
                          data-ai-aliases="assign patient search|find patient|patient lookup"
                          data-ai-intent="lookup"
                        />
                        <select
                          value={selectedPatientId}
                          onChange={(e) => setSelectedPatientId(e.target.value)}
                          data-ai-label="Select Patient"
                          data-ai-aliases="assigned patient|patient|selected patient"
                          data-ai-widget="patient-picker"
                        >
                          <option value="">Select patient</option>
                          {patientOptions.map((patient) => (
                            <option key={patient._id} value={patient._id}>
                              {[patient.firstName, patient.lastName].filter(Boolean).join(" ")}{patient.nationalId ? ` • ${patient.nationalId}` : ""}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="btn-primary" onClick={() => assignPatientToBed(bed)}>
                            Save Assignment
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setAssigningBedId("");
                              setSelectedPatientId("");
                              setPatientQuery("");
                              setPatientOptions([]);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setAssigningBedId(bed._id);
                          setSelectedPatientId("");
                          setPatientQuery("");
                          setPatientOptions([]);
                        }}
                      >
                        Assign
                      </button>
                    )
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (timelineBedId === bed._id) {
                        setTimelineBedId("");
                        setTimeline({ bed: null, logs: [] });
                        return;
                      }
                      loadTimeline(bed);
                    }}
                  >
                    Timeline
                  </button>
                </>
              )}
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
