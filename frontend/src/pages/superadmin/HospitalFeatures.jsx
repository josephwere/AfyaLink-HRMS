import { useEffect, useState } from "react";
import axios from "../../utils/axios";

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
    axios.get(`/api/hospitals/${hospitalId}/features`).then((res) => {
      setHospital(res.data.name);
      setFeatures(res.data.features || {});
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
    await axios.put(`/api/hospitals/${hospitalId}/features`, { features });
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
