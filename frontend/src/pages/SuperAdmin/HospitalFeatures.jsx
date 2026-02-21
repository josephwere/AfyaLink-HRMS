import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

const FEATURE_LIST = [
  "ai",
  "payments",
  "pharmacy",
  "inventory",
  "lab",
  "realtime",
  "auditLogs",
  "adminCreation",
];

export default function HospitalFeatures({ hospitalId }) {
  const [hospital, setHospital] = useState(null);
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/hospitals/${hospitalId}/features`).then((data) => {
      setHospital(data.name);
      setFeatures(data.features || {});
      setLoading(false);
    });
  }, [hospitalId]);

  const toggleFeature = (key) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const save = async () => {
    await apiFetch(`/api/hospitals/${hospitalId}/features`, {
      method: "PUT",
      body: { features },
    });
    alert("Features updated");
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>🏥 {hospital}</h2>

      {FEATURE_LIST.map((key) => (
        <label key={key} style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={!!features[key]}
            onChange={() => toggleFeature(key)}
          />{" "}
          {key}
        </label>
      ))}

      <button onClick={save} style={{ marginTop: 12 }}>
        Save Changes
      </button>
    </div>
  );
}
