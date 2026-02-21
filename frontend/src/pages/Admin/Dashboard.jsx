import { Link } from "react-router-dom";
import { StatCard } from "../../components/Cards";

export default function Dashboard() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
        Admin Tools
      </h1>

      <div className="grid" style={{ marginBottom: 24 }}>
        <StatCard title="Audit Logs" value="Live" subtitle="Security events" />
        <StatCard title="Admin Accounts" value="Manage" subtitle="Create and review" />
        <StatCard title="System Access" value="RBAC" subtitle="Role governance" />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/admin/audit-logs">Open Audit Logs</Link>
        <Link to="/admin/create-admin">Create Admin</Link>
      </div>
    </div>
  );
}
