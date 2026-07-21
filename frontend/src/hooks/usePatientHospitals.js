import { useEffect, useMemo, useState } from "react";
import { listMarketplaceHospitals } from "../services/patientApi";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";
const PATIENT_LOCATION_KEY = "afyalink_patient_location_v1";

export function usePatientHospitals({ q = "", lat = "", lng = "", radiusKm = 100 } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState(() => localStorage.getItem(SELECTED_HOSPITAL_KEY) || "");

  const locationReady = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMsg("");
      try {
        const data = await listMarketplaceHospitals({ q, limit: 100, lat, lng, radiusKm });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!active) return;
        setItems([]);
        setMsg("Failed to load hospitals");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!locationReady) {
      setItems([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    load();
    return () => {
      active = false;
    };
  }, [q, lat, lng, radiusKm, locationReady]);

  const selectedHospital = useMemo(() => items.find((h) => String(h._id) === String(selectedHospitalId)) || null, [items, selectedHospitalId]);

  const selectHospital = (id) => {
    setSelectedHospitalId(id);
    localStorage.setItem(SELECTED_HOSPITAL_KEY, String(id));
  };

  return { items, loading, msg, setMsg, selectedHospitalId, setSelectedHospitalId, selectedHospital, selectHospital };
}

export default usePatientHospitals;
