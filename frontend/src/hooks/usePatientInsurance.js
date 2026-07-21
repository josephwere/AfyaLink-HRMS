import { useEffect, useState } from "react";
import { getMyProfile, listMarketplaceHospitals } from "../services/patientApi";

export function usePatientInsurance(q = "") {
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [me, market] = await Promise.all([getMyProfile(), listMarketplaceHospitals({ q })]);
        if (!active) return;
        setProfile(me || null);
        setHospitals(Array.isArray(market?.items) ? market.items : []);
      } catch {
        if (!active) return;
        setProfile(null);
        setHospitals([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [q]);

  return { profile, hospitals, loading };
}

export default usePatientInsurance;
