import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MedicationSelector from "../../components/MedicationSelector";
import { showActionSuccessGuide } from "../../components/ActionSuccessGuide";
import { useDoctorPrescriptions } from "../../hooks/useDoctorPrescriptions";

function emptyMedication() {
  return {
    pharmacyItem: "",
    name: "",
    sku: "",
    unit: "",
    stockStatus: "",
    availableQuantityAtPrescription: null,
    requestedQuantity: "",
    dosage: "",
    frequency: "",
    duration: "",
  };
}

export default function Prescriptions() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [medications, setMedications] = useState([emptyMedication()]);
  const [summary, setSummary] = useState("");
  const [advice, setAdvice] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [existingPrescription, setExistingPrescription] = useState(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const {
    patient,
    appointments,
    medicineCatalog,
    medicineError,
    pharmacies,
    referrals,
    loadExistingPrescription,
    savePrescriptionDraft,
    sendReferral,
  } = useDoctorPrescriptions(patientId);

  const availablePharmacies = useMemo(
    () =>
      pharmacies.filter((item) => {
        const status = String(item?.status || "ACTIVE").trim().toUpperCase();
        return status === "ACTIVE" || status === "";
      }),
    [pharmacies]
  );

  const medicineById = useMemo(() => {
    const map = new Map();
    medicineCatalog.forEach((item) => map.set(String(item._id), item));
    return map;
  }, [medicineCatalog]);

  useEffect(() => {
    if (!appointments.length) {
      setSelectedAppointmentId("");
      return;
    }

    const currentSelectionStillValid = appointments.some((item) => String(item._id) === String(selectedAppointmentId));
    if (!selectedAppointmentId || !currentSelectionStillValid) {
      const nextAppointment = appointments[0];
      setSelectedAppointmentId(nextAppointment ? String(nextAppointment._id) : "");
      setSummary(nextAppointment?.metadata?.consultationSummary?.prescriptionSummary || "");
      setAdvice(nextAppointment?.metadata?.consultationSummary?.carePlan || "");
    }
  }, [appointments, selectedAppointmentId]);

  useEffect(() => {
    if (!selectedPharmacyId && availablePharmacies.length) {
      setSelectedPharmacyId(String(availablePharmacies[0]._id));
    }
  }, [availablePharmacies, selectedPharmacyId]);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => String(item._id) === String(selectedAppointmentId)) || null,
    [appointments, selectedAppointmentId]
  );

  useEffect(() => {
    if (!selectedAppointment) return;
    setSummary(selectedAppointment?.metadata?.consultationSummary?.prescriptionSummary || "");
    setAdvice(selectedAppointment?.metadata?.consultationSummary?.carePlan || "");
    let cancelled = false;
    loadExistingPrescription(selectedAppointment._id)
      .then((item) => {
        if (cancelled) return;
        setExistingPrescription(item || null);
        if (item?.medications?.length) {
          setMedications(
            item.medications.map((med) => ({
              pharmacyItem: med.pharmacyItem || "",
              name: med.name || "",
              sku: med.sku || "",
              unit: med.unit || "",
              stockStatus: med.stockStatus || "",
              availableQuantityAtPrescription: med.availableQuantityAtPrescription ?? null,
              requestedQuantity: med.requestedQuantity || "",
              dosage: med.dosage || "",
              frequency: med.frequency || "",
              duration: med.duration || "",
            }))
          );
        }
        if (item?.summary) setSummary(item.summary);
        if (item?.advice) setAdvice(item.advice);
      })
      .catch(() => {
        if (!cancelled) setExistingPrescription(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAppointment, loadExistingPrescription]);

  const patchMedication = (index, patch) => {
    setMedications((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const selectMedicine = (index, id) => {
    const selected = medicineById.get(String(id));
    if (!selected) {
      patchMedication(index, {
        pharmacyItem: "",
        name: "",
        sku: "",
        unit: "",
        stockStatus: "",
        availableQuantityAtPrescription: null,
      });
      return;
    }
    patchMedication(index, {
      pharmacyItem: selected._id,
      name: selected.name || "",
      sku: selected.sku || "",
      unit: selected.unit || "",
      stockStatus: selected.stockStatus || "",
      availableQuantityAtPrescription: selected.totalQuantity ?? 0,
    });
  };

  const addMedication = () => setMedications((prev) => [...prev, emptyMedication()]);

  const removeMedication = (index) => {
    setMedications((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const persistPrescription = async ({ showSuccessGuide = true } = {}) => {
    if (!selectedAppointmentId) {
      throw new Error("Select an appointment first.");
    }

    setSaving(true);
    setMsg("");

    try {
      const { created, prescriptionId } = await savePrescriptionDraft({
        appointmentId: selectedAppointmentId,
        patientId,
        medications,
        summary,
        advice,
        existingPrescription,
        selectedAppointment,
      });

      if (created) {
        setExistingPrescription(created);
      }

      if (showSuccessGuide) {
        showActionSuccessGuide({
          title: "Prescription Saved Successfully",
          message: "Patient records have been updated and the prescription plan is ready for pharmacy follow-up.",
          tips: [
            "Send the prescription to a registered pharmacy",
            "Review the appointment summary",
            "Open patient medical records",
          ],
          actions: [
            { label: "Patient Records", path: `/app/care/records/index?patientId=${encodeURIComponent(patientId)}` },
            {
              label: "Ask AI",
              action: "ai",
              aiPrompt: `Review this prescription plan and suggest patient-friendly counseling points. Summary: ${summary || "No summary provided"}. Advice: ${advice || "No advice provided"}.`,
              variant: "secondary",
            },
            { label: "Appointments", path: "/app/operations/scheduling/appointments", variant: "secondary" },
          ],
          aiPrompt: `Review this prescription plan and suggest patient-friendly counseling points. Summary: ${summary || "No summary provided"}. Advice: ${advice || "No advice provided"}.`,
          notificationTitle: "Prescription saved",
          notificationBody: "Patient prescription was generated and linked to the visit.",
          notificationCategory: "PRESCRIPTIONS",
        });
      }

      return { created, prescriptionId };
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    try {
      const { created } = await persistPrescription({ showSuccessGuide: true });
      setMsg(created || existingPrescription ? "Prescription summary updated on the visit record." : "Prescription created and linked to the visit.");
    } catch (err) {
      setMsg(err?.message || "Could not save prescription plan.");
    }
  };

  const sendToPharmacy = async () => {
    if (!selectedPharmacyId || !selectedAppointment) {
      setMsg("Select a pharmacy and appointment first.");
      return;
    }

    let prescriptionId = existingPrescription?._id || selectedAppointment?.metadata?.prescriptionId || null;
    if (!prescriptionId) {
      try {
        const result = await persistPrescription({ showSuccessGuide: false });
        prescriptionId = result?.prescriptionId || null;
      } catch (err) {
        setMsg(err?.message || "Could not save prescription plan before sending it to a pharmacy.");
        return;
      }
    }

    if (!prescriptionId) {
      setMsg("Save the prescription plan first before sending it to a pharmacy.");
      return;
    }
    const patientName =
      selectedAppointment?.patient?.firstName
        ? `${selectedAppointment.patient.firstName} ${selectedAppointment.patient.lastName || ""}`.trim()
        : patient
        ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim()
        : "";
    try {
      await sendReferral({
        pharmacyId: selectedPharmacyId,
        prescriptionId,
        patientName,
        patientPhone: patient?.contact || selectedAppointment?.patient?.contact || "",
        patientUser: patient?.metadata?.userId || null,
        patientRecord: patientId || null,
        reason: `Prescription from ${selectedAppointment.serviceType || "consultation"}`,
        medicationNotes:
          summary ||
          medications
            .filter((item) => item.name)
            .map((item) => `${item.name} ${item.dosage} ${item.frequency} ${item.duration}`.trim())
            .join(", "),
        urgent: false,
      });
      setMsg("Prescription referral sent to pharmacy.");
    } catch (err) {
      setMsg(err?.message || "Could not send prescription to pharmacy.");
    }
  };

  const matchingReferrals = useMemo(() => {
    const patientName =
      selectedAppointment?.patient?.firstName
        ? `${selectedAppointment.patient.firstName} ${selectedAppointment.patient.lastName || ""}`.trim()
        : patient
        ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim()
        : "";
    if (!patientName) return [];
    return referrals.filter((item) => {
      if (existingPrescription?._id && String(item?.prescription?._id || item?.prescription) === String(existingPrescription._id)) {
        return true;
      }
      return String(item.patientName || "").trim() === patientName;
    });
  }, [referrals, selectedAppointment, patient]);

  const latestReferral = matchingReferrals[0] || null;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Prescriptions</h2>
          <p className="muted">Build a medication plan tied to the visit record. This saves the draft into the appointment summary until the encounter workflow is finalized.</p>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Medication Plan</h3>
          <label>Appointment</label>
          <select value={selectedAppointmentId} onChange={(e) => setSelectedAppointmentId(e.target.value)}>
            <option value="">Select appointment</option>
            {appointments.map((item) => (
              <option key={item._id} value={item._id}>
                {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "Visit"} •{" "}
                {item.patient?.firstName
                  ? `${item.patient.firstName} ${item.patient.lastName || ""}`.trim()
                  : item.patient?.name || "Patient"}
              </option>
            ))}
          </select>
          {medicineError ? <div className="muted" style={{ marginTop: 8 }}>{medicineError}</div> : null}
          {!medicineError && medicineCatalog.length ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Select medicines from pharmacy inventory so prescriptions match current stock.
            </p>
          ) : null}

          <div className="alert-stack" style={{ marginTop: 12 }}>
            {medications.map((item, index) => (
              <div key={index} className="card">
                <strong>Medication {index + 1}</strong>
                <div className="panel-grid" style={{ marginTop: 8 }}>
                  <MedicationSelector
                    options={medicineCatalog}
                    value={item.pharmacyItem || ""}
                    onSelect={(id) => selectMedicine(index, id)}
                    placeholder="Search medications or inventory"
                    disabled={medicineCatalog.length === 0}
                  />
                  <input value={item.name} onChange={(e) => patchMedication(index, { name: e.target.value, pharmacyItem: "" })} placeholder="Drug name" />
                  <input value={item.requestedQuantity} onChange={(e) => patchMedication(index, { requestedQuantity: e.target.value })} placeholder={`Quantity${item.unit ? ` (${item.unit})` : ""}`} />
                  <input value={item.dosage} onChange={(e) => patchMedication(index, { dosage: e.target.value })} placeholder="Dosage" />
                  <input value={item.frequency} onChange={(e) => patchMedication(index, { frequency: e.target.value })} placeholder="Frequency" />
                  <input value={item.duration} onChange={(e) => patchMedication(index, { duration: e.target.value })} placeholder="Duration" />
                </div>
                {item.pharmacyItem ? (
                  <p className="muted" style={{ marginTop: 8 }}>
                    Stock: {item.availableQuantityAtPrescription ?? 0} {item.unit || "units"}
                    {item.sku ? ` • SKU ${item.sku}` : ""}
                    {item.stockStatus === "LOW_STOCK" ? " • Low stock, confirm pharmacy can dispense." : ""}
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>
                    Manual entry. Inventory availability will not be verified.
                  </p>
                )}
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => removeMedication(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={addMedication}>
              Add Medication
            </button>
          </div>

          <label style={{ marginTop: 12 }}>Prescription Summary</label>
          <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short prescription summary for the patient record" />

          <label>Patient Advice</label>
          <textarea rows={3} value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Use after food, hydration advice, warning signs, follow-up guidance" />

          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-primary" disabled={saving} onClick={saveDraft}>
              {saving ? "Saving..." : "Save Prescription Plan"}
            </button>
            <button type="button" className="btn-secondary" onClick={sendToPharmacy}>
              Send To Pharmacy
            </button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Visit Context</h3>
          {selectedAppointment ? (
            <div className="alert-stack">
              <div className="card">
                <strong>
                  {selectedAppointment?.patient?.firstName
                    ? `${selectedAppointment.patient.firstName} ${selectedAppointment.patient.lastName || ""}`.trim()
                    : patient
                    ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim()
                    : "Patient"}
                </strong>
                <p className="muted">{selectedAppointment.serviceType || "General Consultation"}</p>
                <p className="muted">Status: {selectedAppointment.status || "Scheduled"}</p>
                {selectedAppointment?.metadata?.consultationSummary?.diagnosis ? (
                  <p className="muted">
                    Diagnosis: {selectedAppointment.metadata.consultationSummary.diagnosis}
                  </p>
                ) : null}
                {existingPrescription ? (
                  <p className="muted">Prescription status: {existingPrescription.status}</p>
                ) : (
                  <p className="muted">No prescription record created yet.</p>
                )}
                <label style={{ marginTop: 10, display: "block" }}>Target Pharmacy</label>
                <select value={selectedPharmacyId} onChange={(e) => setSelectedPharmacyId(e.target.value)}>
                  <option value="">Select pharmacy</option>
                  {availablePharmacies.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} {item?.location?.city ? `• ${item.location.city}` : ""}
                    </option>
                  ))}
                </select>
                {latestReferral ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="action-pill">
                      Referral: {latestReferral.status}
                    </div>
                    <p className="muted" style={{ marginTop: 6 }}>
                      Pharmacy: {latestReferral?.pharmacy?.name || "—"}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="muted">Select an appointment to attach the medication plan.</div>
          )}
        </div>
      </section>
    </div>
  );
}
