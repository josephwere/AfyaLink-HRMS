import React, { useEffect, useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { listLabOpsRecords } from "../../services/labOpsApi";

const EMPTY_ARCHIVE = {
  equipmentLogs: [],
  sampleTracking: [],
  qualityControl: [],
  safetyChecks: [],
};

function exportArchiveSnapshot(snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-archive-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsArchive() {
  const [archive, setArchive] = useState(EMPTY_ARCHIVE);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      listLabOpsRecords({ kind: "EQUIPMENT_LOG", limit: 200 }),
      listLabOpsRecords({ kind: "SAMPLE_TRACKING", limit: 200 }),
      listLabOpsRecords({ kind: "QUALITY_CONTROL", limit: 200 }),
      listLabOpsRecords({ kind: "SAFETY_CHECK", limit: 200 }),
    ])
      .then(([equipmentLogs, sampleTracking, qualityControl, safetyChecks]) => {
        if (!active) return;
        setArchive({
          equipmentLogs: Array.isArray(equipmentLogs?.items) ? equipmentLogs.items : [],
          sampleTracking: Array.isArray(sampleTracking?.items) ? sampleTracking.items : [],
          qualityControl: Array.isArray(qualityControl?.items) ? qualityControl.items : [],
          safetyChecks: Array.isArray(safetyChecks?.items) ? safetyChecks.items : [],
        });
        setMessage("");
      })
      .catch((err) => {
        if (!active) return;
        setArchive(EMPTY_ARCHIVE);
        setMessage(err?.message || "Unable to load the archive snapshot.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const exportPayload = useMemo(
    () => ({
      generatedAt: new Date().toISOString(),
      ...archive,
    }),
    [archive]
  );

  const rows = useMemo(
    () => [
      { label: "Equipment logs", items: archive.equipmentLogs },
      { label: "Sample tracking", items: archive.sampleTracking },
      { label: "Quality control", items: archive.qualityControl },
      { label: "Safety checks", items: archive.safetyChecks },
    ],
    [archive]
  );

  const totalRecords = rows.reduce((sum, row) => sum + row.items.length, 0);

  return (
    <ModuleWorkspace
      title="Reports Archive"
      subtitle="Historical lab operations pulled from the database and ready to export."
      kpis={[
        {
          title: "Archive records",
          value: totalRecords,
          subtitle: "Loaded from the database",
        },
        {
          title: "QC failures",
          value: archive.qualityControl.filter((row) => row.status === "FAIL").length,
          subtitle: "Recent review items",
        },
        {
          title: "Safety hazards",
          value: archive.safetyChecks.filter((row) => row.details?.hazard).length,
          subtitle: "Open follow-up signals",
        },
      ]}
      actions={[
        { label: "Open Reports", variant: "primary", path: "/reports" },
        { label: "Export Archive", onClick: () => exportArchiveSnapshot(exportPayload) },
      ]}
      panels={[
        {
          title: "Completed Records",
          body: "Database-backed operations history across sample, equipment, QC, and safety workflows.",
        },
        {
          title: "Urgent Flags",
          body: "Recent QC failures and safety hazards available for export.",
        },
      ]}
    >
      <section className="section">
        {message ? <div className="premium-inline-note">{message}</div> : null}
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Records</th>
                  <th>Latest Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Loading archive records...</td>
                  </tr>
                ) : null}
                {rows.map((row) => {
                  const latest = row.items[0];
                  return (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.items.length}</td>
                      <td>{latest?.status || "—"}</td>
                      <td>
                        {latest?.observedAt || latest?.createdAt
                          ? new Date(latest.observedAt || latest.createdAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.every((row) => row.items.length === 0) ? (
                  <tr>
                    <td colSpan="4">No archived lab operations records yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </ModuleWorkspace>
  );
}
