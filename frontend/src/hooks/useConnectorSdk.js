import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase, exportRichTextDocument } from "../lib/api/client";
import {
  getConnectorRuntime,
  getConnectorSdkManifest,
  listConnectorSdkTargets,
  updateConnectorRuntime,
} from "../services/systemAdminApi";

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

const API_BASE = getApiBase();

function codeSnippet(baseUrl, connectorId, payload, mode, dryRun) {
  const body = JSON.stringify(payload, null, 2);
  const ingestUrl = `${baseUrl}/api/connectors/${connectorId}/ingest`;
  const runtimeUrl = `${baseUrl}/api/connectors/${connectorId}/runtime`;
  const cursorUrl = `${baseUrl}/api/connectors/${connectorId}/runtime/cursor`;

  return {
    curlIngest: `curl -X POST '${ingestUrl}' \\
  -H 'Authorization: Bearer <TOKEN>' \\
  -H 'Content-Type: application/json' \\
  -H 'x-idempotency-key: <UNIQUE_EVENT_KEY>' \\
  -H 'x-event-id: <EVENT_ID>' \\
  -H 'x-source-cursor: <SOURCE_CURSOR>' \\
  -d '${JSON.stringify(payload)}'`,
    jsIngest: `await fetch('${ingestUrl}', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer <TOKEN>',\n    'Content-Type': 'application/json',\n    'x-idempotency-key': crypto.randomUUID(),\n    'x-event-id': crypto.randomUUID(),\n    'x-source-cursor': '<SOURCE_CURSOR>'\n  },\n  body: JSON.stringify(${body})\n});`,
    curlRuntime: `curl -X GET '${runtimeUrl}' \\
  -H 'Authorization: Bearer <TOKEN>'`,
    curlRuntimePatch: `curl -X PATCH '${runtimeUrl}' \\
  -H 'Authorization: Bearer <TOKEN>' \\
  -H 'Content-Type: application/json' \\
  -d '{"mode":"${mode}","dryRun":${dryRun}}'`,
    curlCursorAck: `curl -X POST '${cursorUrl}' \\
  -H 'Authorization: Bearer <TOKEN>' \\
  -H 'Content-Type: application/json' \\
  -d '{"cursor":"<LATEST_SOURCE_CURSOR>"}'`,
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

export function useConnectorSdk() {
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
    () => connectors.find((connector) => String(connector._id) === String(selectedConnectorId)) || null,
    [connectors, selectedConnectorId]
  );

  const snippets = useMemo(() => {
    if (!selectedConnectorId || !selectedConnector) return null;
    const payload = samplePayloadFor(selectedConnector);
    return codeSnippet(API_BASE, selectedConnectorId, payload, mode, dryRun);
  }, [selectedConnectorId, selectedConnector, mode, dryRun]);

  const copyText = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Snippet copied.");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "readonly");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setMsg("Snippet copied.");
    }
  }, []);

  const loadRuntime = useCallback(async (connectorId) => {
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
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [manifestRes, connectorRes] = await Promise.all([
        getConnectorSdkManifest(),
        listConnectorSdkTargets(),
      ]);
      setManifest(manifestRes || null);
      const resolvedConnectors = Array.isArray(connectorRes) ? connectorRes : [];
      setConnectors(resolvedConnectors);
      const firstConnector = resolvedConnectors[0] || null;
      const firstId = firstConnector?._id ? String(firstConnector._id) : "";
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
  }, [loadRuntime]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSelectConnector = useCallback(async (connectorId) => {
    setSelectedConnectorId(connectorId);
    setMsg("");
    await loadRuntime(connectorId);
  }, [loadRuntime]);

  const saveRuntime = useCallback(async () => {
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
  }, [dryRun, loadRuntime, mode, selectedConnectorId]);

  const downloadSnippets = useCallback((format) => {
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
  }, [selectedConnector, snippets]);

  return {
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
  };
}

export default useConnectorSdk;
