import React, { useMemo } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import { useAuth } from "../../utils/auth";
import { normalizeRole } from "../../utils/normalizeRole";
import { useLabQueue } from "../../hooks/useLabQueue";

export default function LabEncounterQueue() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");
  const canComplete = useMemo(
    () => ["LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN"].includes(role),
    [role]
  );

  const { encounters, loading, refresh, completeEncounterLab } = useLabQueue();
  const [msg, setMsg] = React.useState("");

  async function loadLabQueue() {
    setMsg("");
    try {
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Failed to load lab queue.");
    }
  }

  async function completeLab(encounterId) {
    setMsg("");
    try {
      await completeEncounterLab(encounterId);
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Unable to complete lab.");
    }
  }

  return (
    <DashboardHomeShell
      shellKey="operations_lab_encounter_queue"
      kicker="Operations · Diagnostics"
      title="Encounter Lab Queue"
      subtitle="A single worklist for encounters waiting on lab completion (workflow-enforced)."
      actions={[
        { label: "Refresh", onClick: () => loadLabQueue(), variant: "secondary" },
        { label: "Lab Test Queue", path: "/app/operations/lab/test-queue" },
      ]}
      stats={[
        { label: "Pending", value: encounters.length, note: "Encounters" },
        { label: "Can complete", value: canComplete ? "Yes" : "View-only", note: "Role" },
      ]}
    >
      <DashboardSection
        title="Worklist"
        subtitle="Complete lab only when the workflow allows the transition."
      >
        {msg ? (
          <div className="muted" style={{ color: "#dc2626", marginBottom: 12 }}>
            {msg}
          </div>
        ) : null}

        <div className="card">
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Tests</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>Workflow</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="muted">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && encounters.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="muted">
                      No lab work pending.
                    </td>
                  </tr>
                ) : null}
                {encounters.map((e) => {
                  const workflow = e?.workflow || {};
                  const canCompleteLab = Boolean(workflow?.allowedTransitions?.includes("LAB_COMPLETED"));
                  const canRun = canComplete && canCompleteLab;

                  return (
                    <tr key={e._id}>
                      <td>{e?.patient?.name || e?.patient?.fullName || "—"}</td>
                      <td>{e?.labOrders?.length || 0}</td>
                      <td>{workflow?.state || "—"}</td>
                      <td>
                        {canComplete ? (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={!canCompleteLab}
                            onClick={() => (canRun ? completeLab(e._id) : null)}
                          >
                            Complete Lab
                          </button>
                        ) : (
                          <span className="muted">View only</span>
                        )}
                      </td>
                      <td style={{ minWidth: 280 }}>
                        <WorkflowTimeline encounterId={e._id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
