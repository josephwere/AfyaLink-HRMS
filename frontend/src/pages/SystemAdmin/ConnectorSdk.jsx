import { useEffect, useMemo, useState } from "react";
import DownloadMenu from "../../components/DownloadMenu";
import {
  getConnectorRuntime,
  getConnectorSdkManifest,
  listConnectorSdkTargets,
  updateConnectorRuntime,
} from "../../services/systemAdminApi";
import { exportRichTextDocument } from "../../utils/fileExport";

function samplePayloadFor(connector) {
  const profile = String(connector?.profile || "").toUpperCase();
  const type = String(connector?.type || "").toUpperCase();

  if (profile.includes("FHIR") || type === "FHIR") {
    return {
      sourceType: "FHIR",
      payload: {
        resourceType: "Patient",
        id: "external-patient-123",
        name: [{ family: "Doe", given: ["Jane"] }],
        gender: "female",
      },
    };
  }

  if (profile.includes("HL7") || type === "HL7") {
    return {
      sourceType: "HL7",
      payload: "MSH|^~\\&|LIS|HOSP|AFYALINK|MAIN|20260306||ADT^A04|MSG00001|P|2.5\\rPID|||P12345||DOE^JANE||19900101|F",
    };
  }

  return {
    sourceType: "JSON",
    payload: {
      patientExternalId: "external-patient-123",
      firstName: "Jane",
      lastName: "Doe",
      gender: "female",
    },
  };
}

function getApiBase() {
  const envBase = import.meta.env.VITE_API_URL;
  if (envBase) return String(envBase).replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "http://localhost:5000";
}

function codeSnippet(baseUrl, connectorId, payload, mode, dryRun) {
  const body = JSON.stringify(payload, null, 2);
  const ingestUrl = `${baseUrl}/api/connectors/${connectorId}/ingest`;
  const runtimeUrl = `${baseUrl}/api/connectors/${connectorId}/runtime`;
  const cursorUrl = `${baseUrl}/api/connectors/${connectorId}/runtime/cursor`;

  return {
    curlIngest: `curl -X POST '${ingestUrl}' \\\n  -H 'Authorization: Bearer <TOKEN>' \\\n  -H 'Content-Type: application/json' \\\n  -H 'x-idempotency-key: <UNIQUE_EVENT_KEY>' \\\n  -H 'x-event-id: <EVENT_ID>' \\\n  -H 'x-source-cursor: <SOURCE_CURSOR>' \\\n  -d '${JSON.stringify(payload)}'`,
    jsIngest: `await fetch('${ingestUrl}', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer <TOKEN>',\n    'Content-Type': 'application/json',\n    'x-idempotency-key': crypto.randomUUID(),\n    'x-event-id': crypto.randomUUID(),\n    'x-source-cursor': '<SOURCE_CURSOR>'\n  },\n  body: JSON.stringify(${body})\n});`,
    curlRuntime: `curl -X GET '${runtimeUrl}' \\\n  -H 'Authorization: Bearer <TOKEN>'`,
    curlRuntimePatch: `curl -X PATCH '${runtimeUrl}' \\\n  -H 'Authorization: Bearer <TOKEN>' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"mode":"${mode}","dryRun":${dryRun}}'`,
    curlCursorAck: `curl -X POST '${cursorUrl}' \\\n  -H 'Authorization: Bearer <TOKEN>' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"cursor":"<LATEST_SOURCE_CURSOR>"}'`,
  };
}

function buildSnippetBundle(snippets, connector) {
  if (!snippets) return "";
  const connectorName = connector?.name || "connector";
  const connectorType = String(connector?.type || "custom").toUpperCase();
  return [
    `Connector SDK Snippets - ${connectorName} (${connectorType})`,
    "",
    "## cURL Ingest",
    snippets.curlIngest,
    "",
    "## JavaScript Ingest",
    snippets.jsIngest,
    "",
    "## Get Runtime",
    snippets.curlRuntime,
    "",
    "## Update Runtime",
    snippets.curlRuntimePatch,
    "",
    "## Cursor Acknowledge",
    snippets.curlCursorAck,
    "",
  ].join("\n");
}

export default function ConnectorSdk() {
  const [manifest, setManifest] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState("");
  const [runtimeData, setRuntimeData] = useState(null);
  const [mode, setMode] = useState("SHADOW");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const selectedConnector = useMemo(
    () => connectors.find((c) => String(c._id) === String(selectedConnectorId)) || null,
    [connectors, selectedConnectorId]
  );

  const snippets = useMemo(() => {
    if (!selectedConnectorId || !selectedConnector) return null;
    const payload = samplePayloadFor(selectedConnector);
    return codeSnippet(getApiBase(), selectedConnectorId, payload, mode, dryRun);
  }, [selectedConnectorId, selectedConnector, mode, dryRun]);

  const copyText = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Snippet copied.");
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "readonly");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setMsg("Snippet copied.");
    }
  };

  const loadRuntime = async (connectorId) => {
    if (!connectorId) {
      setRuntimeData(null);
      return;
    }
    try {
      const runtime = await getConnectorRuntime(connectorId);
      setRuntimeData(runtime || null);
      setMode(String(runtime?.runtime?.mode || "SHADOW").toUpperCase());
      setDryRun(runtime?.runtime?.dryRun !== false);
    } catch (err) {
      setRuntimeData(null);
      setMsg(err?.message || "Failed to load connector runtime");
    }
  };

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [manifestRes, connectorRes] = await Promise.all([
        getConnectorSdkManifest(),
        listConnectorSdkTargets(),
      ]);
      setManifest(manifestRes || null);
      setConnectors(Array.isArray(connectorRes) ? connectorRes : []);
      const first = Array.isArray(connectorRes) && connectorRes.length > 0 ? connectorRes[0] : null;
      const firstId = first?._id ? String(first._id) : "";
      setSelectedConnectorId(firstId);
      await loadRuntime(firstId);
    } catch (err) {
      setMsg(err?.message || "Failed to load SDK details");
      setManifest(null);
      setConnectors([]);
      setSelectedConnectorId("");
      setRuntimeData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSelectConnector = async (connectorId) => {
    setSelectedConnectorId(connectorId);
    setMsg("");
    await loadRuntime(connectorId);
  };

  const saveRuntime = async () => {
    if (!selectedConnectorId) return;
    setSaving(true);
    setMsg("");
    try {
      await updateConnectorRuntime(selectedConnectorId, { mode, dryRun });
      setMsg("Connector runtime updated.");
      await loadRuntime(selectedConnectorId);
    } catch (err) {
      setMsg(err?.message || "Failed to update runtime");
    } finally {
      setSaving(false);
    }
  };

  const downloadSnippets = (format) => {
    if (!snippets || !selectedConnector) return;
    const text = buildSnippetBundle(snippets, selectedConnector);
    const safeName = String(selectedConnector?.name || "connector")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    exportRichTextDocument({
      filenameBase: `${safeName || "connector"}-sdk-snippets`,
      format,
      plainText: text,
      markdownText: text,
      htmlBody: `<pre>${text}</pre>`,
      title: `${selectedConnector?.name || "Connector"} SDK Snippets`,
    });
    setMsg(format === "pdf" ? "PDF export opened." : `Downloaded ${safeName || "connector"} SDK snippets as .${format}.`);
  };

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
