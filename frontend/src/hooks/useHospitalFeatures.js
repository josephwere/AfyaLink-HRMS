import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export function useHospitalFeatures(hospitalId) {
  const [hospital, setHospital] = useState(null);
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/hospitals/${hospitalId}/features`)
      .then((data) => {
        if (!active) return;
        setHospital(data.name);
        setFeatures(data.features || {});
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setHospital(null);
        setFeatures({});
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hospitalId]);

  const toggleFeature = (key) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    await apiFetch(`/api/hospitals/${hospitalId}/features`, {
      method: "PUT",
      body: { features },
    });
    alert("Features updated");
  };

  return {
    hospital,
    features,
    loading,
    toggleFeature,
    save,
  };
}

export default useHospitalFeatures;
