import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { StatCard } from "../../components/Cards";
import { listMyReports } from "../../services/reportsApi";
import { selfRegisterMinorPatient } from "../../services/patientApi";

export default function FamilyRecords() {
  const navigate = useNavigate();
  const [family, setFamily] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [reports, setReports] = useState([]);
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    nationalId: "",
    contact: "",
    hospitalId: "",
    relationship: "PARENT",
    notes: "",
  });

  const loadFamilyData = async () => {
    const [familyRes, encounterRows, reportRes, profileRes, hospitalRes] = await Promise.all([
      apiFetch("/api/profile/family"),
      apiFetch("/api/encounters?limit=50"),
      listMyReports({ cursorMode: true, limit: 25 }),
      apiFetch("/api/profile"),
      apiFetch("/api/hospitals/marketplace?limit=200"),
    ]);

    const linked = Array.isArray(familyRes?.items) ? familyRes.items : [];
    const patientIds = new Set(linked.map((item) => String(item.patientId)));
    const encounterItems = Array.isArray(encounterRows) ? encounterRows : [];
    const reportItems = Array.isArray(reportRes?.items) ? reportRes.items : Array.isArray(reportRes) ? reportRes : [];
    const hospitalItems = Array.isArray(hospitalRes?.items) ? hospitalRes.items : Array.isArray(hospitalRes) ? hospitalRes : [];

    setFamily(linked);
    setEncounters(
      encounterItems.filter((row) => patientIds.has(String(row?.patient?._id || row?.patient || "")))
    );
    setReports(
      reportItems.filter((row) => patientIds.has(String(row?.patient?._id || row?.patient || "")))
    );
    setProfile(profileRes || null);
    setHospitals(hospitalItems);
    setRegisterForm((prev) => ({
      ...prev,
      hospitalId: prev.hospitalId || profileRes?.hospital || hospitalItems?.[0]?._id || "",
    }));
  };

  useEffect(() => {
    loadFamilyData()
      .catch((err) => {
        setFamily([]);
        setEncounters([]);
        setReports([]);
        setMsg(err?.message || "Failed to load family records.");
      });
  }, []);

  const registerMinor = async () => {
    setRegisterBusy(true);
    setMsg("");
    try {
      await selfRegisterMinorPatient(registerForm);
      setRegisterForm((prev) => ({
        ...prev,
        firstName: "",
        lastName: "",
        dob: "",
        gender: "",
        nationalId: "",
        contact: "",
        notes: "",
      }));
      await loadFamilyData();
      setMsg("Child registered successfully and linked under your parent account.");
    } catch (err) {
      setMsg(err?.message || "Failed to register child.");
    } finally {
      setRegisterBusy(false);
    }
  };

  const totals = useMemo(
    () => ({
      children: family.length,
      appointments: family.reduce((sum, item) => sum + Number(item?.upcomingAppointments || 0), 0),
      encounters: family.reduce((sum, item) => sum + Number(item?.totalEncounters || 0), 0),
      reports: reports.length,
    }),
    [family, reports]
  );

  const familyPolicyMap = useMemo(
    () => new Map(family.map((item) => [String(item.patientId), item.consentPolicy || null])),
    [family]
  );

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Family Records</h2>
          <p className="muted">
            Parent-facing view of linked minor care records, reports, and recent encounter activity.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/profile")}>
            Manage Linked Children
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/notifications?category=WELLNESS")}>
            Daily Quotes
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/billing")}>
            Billing View
          </button>
        </div>
      </div>

      {msg ? (
        <section className="section">
          <div className="card">{msg}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Register a Child Under Your Account</h3>
              <p className="muted">
                This creates a minor profile under your parent national ID so the child follows your family record trail across hospitals.
              </p>
            </div>
            <div className="action-pill">
              Parent ID: {profile?.nationalIdNumber || "Add your national ID in Profile first"}
            </div>
          </div>

          {!profile?.nationalIdNumber ? (
            <div className="subtle-banner" style={{ marginTop: 12 }}>
              Add your national ID in Profile before self-registering a child. This is the family anchor used by hospitals and parent monitoring.
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
              <input
                placeholder="Child first name"
                value={registerForm.firstName}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
              <input
                placeholder="Child last name"
                value={registerForm.lastName}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
              <input
                type="date"
                value={registerForm.dob}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, dob: e.target.value }))}
              />
              <select
                value={registerForm.gender}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, gender: e.target.value }))}
              >
                <option value="">Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                placeholder="Child national ID / birth cert (optional)"
                value={registerForm.nationalId}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, nationalId: e.target.value }))}
              />
              <input
                placeholder="Child contact (optional)"
                value={registerForm.contact}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, contact: e.target.value }))}
              />
              <select
                value={registerForm.hospitalId}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, hospitalId: e.target.value }))}
              >
                <option value="">Select hospital</option>
                {hospitals.map((hospital) => (
                  <option key={hospital._id} value={hospital._id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
              <select
                value={registerForm.relationship}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, relationship: e.target.value }))}
              >
                <option value="PARENT">Parent</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="CAREGIVER">Caregiver</option>
              </select>
              <textarea
                placeholder="Registration note for this child (optional)"
                value={registerForm.notes}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          )}

          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-primary"
              disabled={
                registerBusy ||
                !profile?.nationalIdNumber ||
                !registerForm.firstName.trim() ||
                !registerForm.lastName.trim() ||
                !registerForm.dob ||
                !registerForm.hospitalId
              }
              onClick={registerMinor}
            >
              {registerBusy ? "Registering..." : "Register Child"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>
              Update Parent Identity
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Linked Children" value={totals.children} onClick={() => navigate("/profile")} />
          <StatCard title="Upcoming Visits" value={totals.appointments} onClick={() => navigate("/patient/appointments")} />
          <StatCard title="Tracked Encounters" value={totals.encounters} onClick={() => navigate("/patient/medical-records")} />
          <StatCard title="Clinical Reports" value={totals.reports} onClick={() => navigate("/reports")} />
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Linked Child Profiles</h3>
              <p className="muted">Each child linked to your account with recent care signals.</p>
            </div>
            <div className="action-pill">{family.length} profiles</div>
          </div>

          {family.length ? (
            <div className="panel-grid" style={{ marginTop: 12 }}>
              {family.map((item) => (
                <div key={item.patientId} className="card premium-card">
                  <h4>{item.name}</h4>
                  <p className="muted">
                    {item.relationship || "Parent"} • Age {item.age ?? "—"} • {item.hospitalName || "Hospital not set"}
                  </p>
                  {item.consentPolicy ? (
                    <div className="action-pill" style={{ marginTop: 8 }}>
                      {item.consentPolicy.mode === "SHARED_TEEN_ACCESS"
                        ? `Teen shared access • ${item.consentPolicy.countryCode}`
                        : `Parent proxy access • ${item.consentPolicy.countryCode}`}
                    </div>
                  ) : null}
                  <p className="muted">
                    Upcoming appointments: {item.upcomingAppointments} • Encounters: {item.totalEncounters} • Reports: {reports.filter((row) => String(row?.patient?._id || row?.patient || "") === String(item.patientId)).length}
                  </p>
                  <p className="muted">
                    Latest diagnosis: {item.consentPolicy?.permissions?.detailedClinicalNotes === false
                      ? "Detailed teen clinical notes are hidden in shared-access mode."
                      : item.latestDiagnosis || "No diagnosis captured yet"}
                  </p>
                  {item.consentPolicy?.note ? (
                    <p className="muted">{item.consentPolicy.note}</p>
                  ) : null}
                  <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn-secondary" onClick={() => navigate("/patient/medical-records")}>
                      Open Timeline
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>
                      Open Reports
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              No linked child records yet. Register a child above or use Profile to link an existing minor record.
            </div>
          )}
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Recent Encounter Activity</h3>
          {encounters.length ? (
            <div className="alert-stack">
              {encounters.slice(0, 12).map((row) => (
                <div key={row._id} className="card">
                  {familyPolicyMap.get(String(row?.patient?._id || row?.patient || ""))?.mode === "SHARED_TEEN_ACCESS" ? (
                    <div className="action-pill" style={{ marginBottom: 8 }}>Teen shared access</div>
                  ) : null}
                  <strong>{row?.patient?.name || "Child encounter"}</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {familyPolicyMap.get(String(row?.patient?._id || row?.patient || ""))?.permissions?.detailedClinicalNotes === false
                      ? "Visit summary visible, confidential details hidden"
                      : row.diagnosis || "Visit record"}{" "}
                    • {row.state || "CREATED"}
                  </p>
                  <p className="muted">
                    {familyPolicyMap.get(String(row?.patient?._id || row?.patient || ""))?.permissions?.detailedClinicalNotes === false
                      ? "Shared teen access keeps care coordination details visible while confidential notes stay limited."
                      : row.consultationNotes || "No consultation notes captured yet."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No linked encounter history yet.</div>
          )}
        </div>

        <div className="card doctor-alerts-card">
          <h3>Recent Reports</h3>
          {reports.length ? (
            <div className="alert-stack">
              {reports.slice(0, 12).map((row) => (
                <div key={row._id} className="card">
                  {familyPolicyMap.get(String(row?.patient?._id || row?.patient || ""))?.mode === "SHARED_TEEN_ACCESS" ? (
                    <div className="action-pill" style={{ marginBottom: 8 }}>Teen shared access</div>
                  ) : null}
                  <strong>{row.title || "Clinical Report"}</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {row?.patient?.firstName
                      ? `${row.patient.firstName} ${row.patient.lastName || ""}`.trim()
                      : "Linked child"}
                  </p>
                  <p className="muted">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                  </p>
                  <p className="muted">
                    {familyPolicyMap.get(String(row?.patient?._id || row?.patient || ""))?.permissions?.reportContentPreview === false
                      ? "Report preview hidden in teen shared-access mode. Open with the adolescent present or use approved consent workflow."
                      : row.content ? String(row.content).slice(0, 180) : "No report preview available."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No linked reports yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
