import { useEffect } from "react";
import DownloadMenu from "../../components/DownloadMenu";
import { useConnectorSdk } from "../../hooks/useConnectorSdk";

export default function ConnectorSdk() {
  const {
    manifest,
    connectors,
    selectedConnectorId,
    setSelectedConnectorId,
    runtimeData,
    mode,
    setMode,
    dryRun,
    setDryRun,
    loading,
    saving,
    msg,
    selectedConnector,
    snippets,
    copyText,
    load,
    loadRuntime,
    onSelectConnector,
    saveRuntime,
    downloadSnippets,
  } = useConnectorSdk();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Connector SDK</h2>
          <p className="muted">View manifest and runtime, then copy integration snippets for any connector.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="card premium-card">
          <h3>SDK Manifest</h3>
          {!manifest ? (
            <p className="muted">Manifest not available.</p>
          ) : (
            <div className="grid info-grid">
              <div>
                <strong>SDK Version</strong>
                <div className="muted">{manifest.sdkVersion || "—"}</div>
              </div>
              <div>
                <strong>Migration Modes</strong>
                <div className="muted">{Array.isArray(manifest.migrationModes) ? manifest.migrationModes.join(", ") : "—"}</div>
              </div>
              <div>
                <strong>Source Types</strong>
                <div className="muted">{Array.isArray(manifest.sourceTypes) ? manifest.sourceTypes.join(", ") : "—"}</div>
              </div>
              <div>
                <strong>Push Endpoint</strong>
                <div className="muted">{manifest.pushEndpoint || "—"}</div>
              </div>
              <div>
                <strong>Pull Runtime Endpoint</strong>
                <div className="muted">{manifest.pullStateEndpoint || "—"}</div>
              </div>
              <div>
                <strong>Cursor Ack Endpoint</strong>
                <div className="muted">{manifest.cursorAckEndpoint || "—"}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Connector Runtime</h3>
          <div className="grid-3" style={{ gap: 10 }}>
            <select value={selectedConnectorId} onChange={(e) => onSelectConnector(e.target.value)}>
              <option value="">Select connector</option>
              {connectors.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({String(c.type || "custom").toUpperCase()})
                </option>
              ))}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={!selectedConnectorId}>
              {(manifest?.migrationModes || ["SHADOW", "MIRROR", "CUTOVER", "ROLLBACK", "PAUSED"]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={!selectedConnectorId}
              />
              Dry Run
            </label>
          </div>
          <div className="welcome-actions mt-12">
            <button type="button" className="btn-primary" onClick={saveRuntime} disabled={!selectedConnectorId || saving}>
              {saving ? "Saving..." : "Save Runtime"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => loadRuntime(selectedConnectorId)} disabled={!selectedConnectorId}>
              Reload Runtime
            </button>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table premium-table">
              <tbody>
                <tr>
                  <td>Connector</td>
                  <td>{selectedConnector?.name || "—"}</td>
                </tr>
                <tr>
                  <td>Type</td>
                  <td>{runtimeData?.type || "—"}</td>
                </tr>
                <tr>
                  <td>Profile</td>
                  <td>{runtimeData?.profile || "—"}</td>
                </tr>
                <tr>
                  <td>Mode</td>
                  <td>{runtimeData?.runtime?.mode || "—"}</td>
                </tr>
                <tr>
                  <td>Dry Run</td>
                  <td>{runtimeData?.runtime?.dryRun === false ? "false" : "true"}</td>
                </tr>
                <tr>
                  <td>Last Cursor</td>
                  <td>{runtimeData?.runtime?.lastCursor || "—"}</td>
                </tr>
                <tr>
                  <td>Last Success</td>
                  <td>{runtimeData?.runtime?.lastSuccessAt || "—"}</td>
                </tr>
                <tr>
                  <td>Last Error</td>
                  <td>{runtimeData?.runtime?.lastErrorAt || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
            <h3>Copy-Paste Snippets</h3>
            <div className="welcome-actions">
              <DownloadMenu
                label="Download"
                disabled={!snippets}
                options={[
                  { value: "txt", label: "Download .txt", onClick: () => downloadSnippets("txt") },
                  { value: "md", label: "Download .md", onClick: () => downloadSnippets("md") },
                  { value: "doc", label: "Download .doc (Word)", onClick: () => downloadSnippets("doc") },
                  { value: "html", label: "Download .html", onClick: () => downloadSnippets("html") },
                  { value: "pdf", label: "Export PDF", onClick: () => downloadSnippets("pdf") },
                ]}
              />
            </div>
          </div>
          {!snippets ? (
            <p className="muted">Select a connector to generate snippets.</p>
          ) : (
            <div className="grid" style={{ gap: 12 }}>
              <div>
                <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
                  <strong>cURL Ingest</strong>
                  <button type="button" className="btn-secondary" onClick={() => copyText(snippets.curlIngest)}>
                    Copy
                  </button>
                </div>
                <textarea readOnly rows={7} value={snippets.curlIngest} />
              </div>
              <div>
                <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
                  <strong>JavaScript Ingest</strong>
                  <button type="button" className="btn-secondary" onClick={() => copyText(snippets.jsIngest)}>
                    Copy
                  </button>
                </div>
                <textarea readOnly rows={10} value={snippets.jsIngest} />
              </div>
              <div>
                <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
                  <strong>Get Runtime</strong>
                  <button type="button" className="btn-secondary" onClick={() => copyText(snippets.curlRuntime)}>
                    Copy
                  </button>
                </div>
                <textarea readOnly rows={3} value={snippets.curlRuntime} />
              </div>
              <div>
                <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
                  <strong>Update Runtime</strong>
                  <button type="button" className="btn-secondary" onClick={() => copyText(snippets.curlRuntimePatch)}>
                    Copy
                  </button>
                </div>
                <textarea readOnly rows={4} value={snippets.curlRuntimePatch} />
              </div>
              <div>
                <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
                  <strong>Cursor Acknowledge</strong>
                  <button type="button" className="btn-secondary" onClick={() => copyText(snippets.curlCursorAck)}>
                    Copy
                  </button>
                </div>
                <textarea readOnly rows={4} value={snippets.curlCursorAck} />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
