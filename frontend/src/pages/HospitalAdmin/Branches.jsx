import React, { useEffect, useState } from "react";
import API_BASE from "../../config/api";


export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  async function fetchBranches() {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      setBranches(data.data || []);
    } catch (err) {
      console.error("Failed to load branches", err);
    } finally {
      setLoading(false);
    }
  }

  async function createBranch(e) {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location }),
      });

      setName("");
      setLocation("");
      fetchBranches();
    } catch (err) {
      console.error("Failed to create branch", err);
    }
  }

  useEffect(() => {
    fetchBranches();
  }, []);

  if (loading) return <div>Loading branches...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Hospital Branches</h1>

      <form className="card p-4 mb-4" onSubmit={createBranch}>
        <h2>Add New Branch</h2>

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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
