import { useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function AdminWorkflowOverride({ workflowId }) {
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(decision) {
    if (!reason.trim()) {
      setMsg("Justification is required");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/api/admin/workflows/override", {
        method: "POST",
        body: {
          workflowId,
          decision,
          reason,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMsg(data.message);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card sub-card">
      <h4>Admin Override</h4>

      {msg && <div style={{ color: "red" }}>{msg}</div>}

      <textarea
        placeholder="Mandatory justification…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button
        disabled={loading}
        onClick={() => submit("APPROVE")}
        style={{ marginRight: 8 }}
      >
        Force Approve
      </button>

      <button
        disabled={loading}
        onClick={() => submit("REJECT")}
        style={{ background: "#dc2626", color: "white" }}
      >
        Force Reject
      </button>
    </div>
  );
}
