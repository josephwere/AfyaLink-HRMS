import { useEffect, useState } from "react";
import axios from "../utils/api"; // your axios instance

export const useHospitalConfig = () => {
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        const res = await axios.get("/hospital/config");
        if (mounted) setHospital(res.data);
      } catch (err) {
        console.error("Failed to load hospital config");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadConfig();
    return () => (mounted = false);
  }, []);

  return { hospital, features: hospital?.features || {}, loading };
};
