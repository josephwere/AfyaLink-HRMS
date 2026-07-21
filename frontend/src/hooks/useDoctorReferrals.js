import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import {
  createPharmacyReferral,
  listPharmacyReferrals,
  listRegisteredPharmacies,
} from "../services/pharmacyNetworkApi";
import { getPatient } from "../services/patientApi";

const buildInitialForm = (patient) => ({
  patientName: `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim(),
  patientPhone: patient?.phone || patient?.contact?.phone || "",
  reason: "",
  medicationNotes: "",
  urgent: false,
});

export function useDoctorReferrals(patientId) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [q, setQ] = useState("");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [referralSaved, setReferralSaved] = useState(false);
  const [referralEditing, setReferralEditing] = useState(true);
  const [form, setForm] = useState(buildInitialForm(null));

  const selectedPharmacy = useMemo(
    () => pharmacies.find((item) => String(item._id) === String(selectedPharmacyId)) || null,
    [pharmacies, selectedPharmacyId]
  );

  const loadContext = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [patientData, pharmacyData, referralData] = await Promise.all([
        patientId ? getPatient(patientId) : Promise.resolve(null),
        listRegisteredPharmacies({ limit: 200, q }),
        listPharmacyReferrals({ limit: 100 }),
      ]);
      setPatient(patientData || null);
      setPharmacies(Array.isArray(pharmacyData?.items) ? pharmacyData.items : []);
      setReferrals(Array.isArray(referralData?.items) ? referralData.items : []);
      setForm(buildInitialForm(patientData || null));
    } catch (err) {
      setMsg(err?.message || "Failed to load referral context.");
    } finally {
      setLoading(false);
    }
  }, [patientId, q]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const submit = useCallback(async () => {
    if (!selectedPharmacyId) {
      setMsg("Select a pharmacy before sending the referral.");
      return false;
    }
    setSaving(true);
    setMsg("");
    try {
      const created = await createPharmacyReferral({
        patientId,
        pharmacyId: selectedPharmacyId,
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        reason: form.reason,
        medicationNotes: form.medicationNotes,
        urgent: Boolean(form.urgent),
        doctorId: user?.id || user?._id || null,
      });
      setReferralSaved(Boolean(created));
      setReferralEditing(false);
      setMsg("Referral sent.");
      await loadContext();
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not send referral.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, loadContext, patientId, selectedPharmacyId, user?.id, user?._id]);

  return {
    patient,
    pharmacies,
    referrals,
    q,
    setQ,
    selectedPharmacyId,
    setSelectedPharmacyId,
    loading,
    saving,
    msg,
    setMsg,
    referralSaved,
    referralEditing,
    setReferralEditing,
    form,
    setForm,
    selectedPharmacy,
    submit,
    refresh: loadContext,
  };
}

export default useDoctorReferrals;
