import React, { useEffect, useState } from "react";
import { useHospitalAdminOperations } from "../../hooks/useHospitalAdminOperations";

export default function Branches() {
  const { branches, branchLoading: loading, branchMsg: msg, loadBranches, createBranch } = useHospitalAdminOperations();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [branchLicenseRequired, setBranchLicenseRequired] = useState(false);

  async function handleCreateBranch(e) {
    e.preventDefault();
    await createBranch({ name, location, email, phone, registrationNumber, branchLicenseRequired });
    setName("");
    setLocation("");
    setEmail("");
    setPhone("");
    setRegistrationNumber("");
    setBranchLicenseRequired(false);
  }

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  if (loading) return <div>Loading branches...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Hospital Branches</h1>
      {msg ? <div className="card p-4 mb-4">{msg}</div> : null}

      <form className="card p-4 mb-4" onSubmit={handleCreateBranch}>
        <h2>Add New Branch Under Parent Hospital</h2>

        <input
          className="input"
          placeholder="Branch Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          className="input mt-2"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        <input
          className="input mt-2"
          placeholder="Branch contact email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="input mt-2"
          placeholder="Branch contact phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <label className="profile-inline-check mt-2">
          <input
            type="checkbox"
            checked={branchLicenseRequired}
            onChange={(e) => setBranchLicenseRequired(e.target.checked)}
          />
          <span>This branch needs its own government license</span>
        </label>

        <input
          className="input mt-2"
          placeholder="Branch registration number (if required)"
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
          disabled={!branchLicenseRequired}
        />

        <p className="muted mt-2">
          Branches cannot register independently. They are tied to the verified parent hospital and, where required, their own government branch license is checked.
        </p>

        <button className="btn btn-primary mt-3" type="submit">
          Create Branch
        </button>
      </form>

      <div className="card p-4">
        <h2>Existing Branches</h2>

        {branches.length === 0 ? (
          <p>No branches created yet.</p>
        ) : (
          <ul className="list">
            {branches.map((b) => (
              <li key={b._id} className="list-item">
                <strong>{b.name}</strong> — {b.location}
                <div className="muted">
                  Parent: {b.parentHospitalName || "-"} • Verification: {b?.verification?.status || "UNVERIFIED"}
                  {b?.verification?.registrationNumber ? ` • Branch License: ${b.verification.registrationNumber}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
