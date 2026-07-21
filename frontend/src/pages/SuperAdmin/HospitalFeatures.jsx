import { useEffect, useState } from "react";
import { useHospitalFeatures } from "../../hooks/useHospitalFeatures";

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
  const { hospital, features, loading, toggleFeature, save } = useHospitalFeatures(hospitalId);

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

      <button type="button" onClick={save} style={{ marginTop: 12 }}>
        Save Changes
      </button>
    </div>
  );
}
