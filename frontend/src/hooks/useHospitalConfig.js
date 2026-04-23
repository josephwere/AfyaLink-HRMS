import { useEffect, useState } from "react";
import api from "../utils/api";
import { getAccessToken } from "../utils/browserSession";

export const useHospitalConfig = () => {
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      const token = getAccessToken();
      if (!token) {
        if (mounted) {
          setHospital(null);
          setLoading(false);
        }
        return;
      }

      let role = "";
      try {
        role = JSON.parse(localStorage.getItem("user") || "{}")?.role || "";
      } catch {
        role = "";
      }

      // Avoid noisy 400s for non hospital-admin roles.
      if (role !== "HOSPITAL_ADMIN") {
        if (mounted) {
          setHospital(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await api.get("/api/hospital-admin/config");
        if (mounted) setHospital(res.data);
      } catch {
        if (mounted) setHospital(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadConfig();
    return () => (mounted = false);
  }, []);

  return { hospital, features: hospital?.features || {}, loading };
};
