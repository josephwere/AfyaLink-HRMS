import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { formatDateTime } from "../../utils/locale";
import { resolveApiBase } from "../../utils/networkBase";

const emptyDevice = {
  name: "",
  code: "",
  department: "",
  machineType: "LAB_ANALYZER",
  protocol: "HL7",
  active: true,
  capabilities: {
    ingestLabResults: true,
    ingestVitals: false,
    ingestImaging: false,
    pushAlerts: false,
  },
};

const emptyLabTest = {
  machineKey: "",
  labOrderId: "",
  testName: "",
  patientId: "",
  externalResultId: "",
  resultJson: '{ "HB": 13.2, "WBC": 7.4 }',
};

const defaultHl7Sample =
  "MSH|^~\\&|LAB|AFYALINK|HIS|AFYALINK|202603021200||ORU^R01|MSG00001|P|2.3\r\nPID|1||P-1001||DOE^JOHN||19870101|M|||Nairobi^^KE||+254700000001\r\nOBR|1||ORD-8891|FBC^FULL BLOOD COUNT\r\nOBX|1|NM|HB^Hemoglobin||13.2|g/dL|12-16|N";

function parseJsonSafe(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

export default function MachineConnectivity() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [overview, setOverview] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState({
    machineId: "",
    action: "ALL",
    from: "",
    to: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [newKey, setNewKey] = useState("");
  const [deviceForm, setDeviceForm] = useState(emptyDevice);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [testForm, setTestForm] = useState(emptyLabTest);
  const [testing, setTesting] = useState(false);
  const [hl7Input, setHl7Input] = useState(defaultHl7Sample);
  const [hl7Output, setHl7Output] = useState(null);
  const [dicomForm, setDicomForm] = useState({
    studyUid: "",
    modality: "CT",
    patientId: "",
    accessionNumber: "",
    aet: "AFYALINK-PACS",
  });
  const [dicomOutput, setDicomOutput] = useState(null);
  const registerSectionRef = useRef(null);
  const devicesSectionRef = useRef(null);
  const testsSectionRef = useRef(null);
  const protocolSectionRef = useRef(null);
  const auditSectionRef = useRef(null);

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectedDevice = useMemo(
    () => devices.find((d) => String(d._id) === String(selectedDeviceId)) || null,
    [devices, selectedDeviceId]
  );

  const loadDevices = async () => {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch("/api/machine-connectivity/devices");
      const rows = Array.isArray(data?.items) ? data.items : [];
      setDevices(rows);
      if (!selectedDeviceId && rows.length) setSelectedDeviceId(rows[0]._id);
    } catch (e) {
      setMsg(e?.message || "Failed to load machine devices");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async () => {
    try {
      const data = await apiFetch("/api/machine-connectivity/overview");
      setOverview(data || null);
    } catch {
      setOverview(null);
    }
  };

  const loadAudit = async (page = auditPage) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (auditFilters.machineId) params.set("machineId", auditFilters.machineId);
      if (auditFilters.action && auditFilters.action !== "ALL") params.set("action", auditFilters.action);
      if (auditFilters.from) params.set("from", auditFilters.from);
      if (auditFilters.to) params.set("to", auditFilters.to);
      const data = await apiFetch(`/api/machine-connectivity/audit?${params.toString()}`);
      setAuditRows(Array.isArray(data?.items) ? data.items : []);
      setAuditTotal(Number(data?.total || 0));
      setAuditPage(Number(data?.page || page));
    } catch {
      setAuditRows([]);
      setAuditTotal(0);
    }
  };

  useEffect(() => {
    loadDevices();
    loadOverview();
    loadAudit(1);
    const t = setInterval(loadDevices, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadAudit(1);
  }, [auditFilters.machineId, auditFilters.action, auditFilters.from, auditFilters.to]);

  const registerDevice = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setNewKey("");
    try {
      const payload = {
        ...deviceForm,
        code: String(deviceForm.code || "").trim().toUpperCase(),
      };
      const data = await apiFetch("/api/machine-connectivity/devices", {
        method: "POST",
        body: payload,
      });
      setNewKey(data?.machineKey || "");
      setDeviceForm(emptyDevice);
      await loadDevices();
      setMsg("Machine registered successfully.");
    } catch (e2) {
      setMsg(e2?.message || "Failed to register machine");
    } finally {
      setSaving(false);
    }
  };

  const rotateKey = async (deviceId) => {
    setSaving(true);
    setMsg("");
    setNewKey("");
    try {
      const data = await apiFetch(`/api/machine-connectivity/devices/${deviceId}/rotate-key`, {
        method: "POST",
      });
      setNewKey(data?.machineKey || "");
      setMsg("Machine key rotated. Store the new key securely.");
    } catch (e) {
      setMsg(e?.message || "Failed to rotate machine key");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (deviceId, status) => {
    try {
      await apiFetch(`/api/machine-connectivity/devices/${deviceId}`, {
        method: "PATCH",
        body: { status },
      });
      await loadDevices();
    } catch (e) {
      setMsg(e?.message || "Failed to update machine status");
    }
  };

  const machinePost = async (path, machineKey, body = {}) => {
    const base = resolveApiBase(import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "");
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-machine-key": machineKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Machine request failed");
    }
    return data;
  };

  const testHeartbeat = async () => {
    if (!testForm.machineKey.trim()) {
      setMsg("Enter machine key first.");
      return;
    }
    setTesting(true);
    setMsg("");
    try {
      const data = await machinePost(
        "/api/machine-connectivity/heartbeat",
        testForm.machineKey.trim(),
        {}
      );
      setMsg(`Heartbeat OK: ${data?.status || "ONLINE"} @ ${data?.serverTime || "-"}`);
      await loadDevices();
    } catch (e) {
      setMsg(e?.message || "Heartbeat test failed");
    } finally {
      setTesting(false);
    }
  };

  const testLabIngest = async (e) => {
    e.preventDefault();
    if (!testForm.machineKey.trim() || !testForm.labOrderId.trim()) {
      setMsg("Machine key and Lab Order ID are required.");
      return;
    }
    const parsed = parseJsonSafe(testForm.resultJson);
    if (!parsed.ok) {
      setMsg("Result JSON is invalid.");
      return;
    }
    setTesting(true);
    setMsg("");
    try {
      const data = await machinePost(
        "/api/machine-connectivity/lab-results",
        testForm.machineKey.trim(),
        {
          labOrderId: testForm.labOrderId.trim(),
          testName: testForm.testName.trim() || undefined,
          patientId: testForm.patientId.trim() || undefined,
          externalResultId: testForm.externalResultId.trim() || undefined,
          resultStatus: "completed",
          result: parsed.value,
        }
      );
      setMsg(
        `Lab ingestion OK: order ${data?.labOrderId || "-"} marked ${data?.status || "Completed"}`
      );
      await loadDevices();
    } catch (e2) {
      setMsg(e2?.message || "Lab ingestion test failed");
    } finally {
      setTesting(false);
    }
  };

  const runHl7ParseTest = async () => {
    setTesting(true);
    setMsg("");
    try {
      const data = await apiFetch("/api/machine-connectivity/test/hl7-parse", {
        method: "POST",
        body: { hl7: hl7Input },
      });
      setHl7Output(data);
      setMsg("HL7 parse test succeeded.");
    } catch (e) {
      setMsg(e?.message || "HL7 parse test failed");
      setHl7Output(null);
    } finally {
      setTesting(false);
    }
  };

  const runDicomStubTest = async () => {
    setTesting(true);
    setMsg("");
    try {
      const data = await apiFetch("/api/machine-connectivity/test/dicom-stub", {
        method: "POST",
        body: dicomForm,
      });
      setDicomOutput(data);
      setMsg("DICOM stub test succeeded.");
    } catch (e) {
      setMsg(e?.message || "DICOM stub test failed");
      setDicomOutput(null);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Machine Connectivity</h2>
          <p className="muted">
            Register and manage analyzers/monitors/PACS connectors, rotate keys, validate heartbeat,
            and test lab result ingestion.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={loadDevices} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Devices"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/machine-alerts")}>
            Open Machine Alerts
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}
      {newKey && (
        <div className="card">
          <strong>New Machine Key (shown once): </strong>
          <code>{newKey}</code>
        </div>
      )}

      <section className="section" ref={registerSectionRef}>
        <h3>Register Machine Device</h3>
        <form className="card form" onSubmit={registerDevice}>
          <input
            placeholder="Machine Name (e.g. Cobas 6000)"
            value={deviceForm.name}
            onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            placeholder="Machine Code (e.g. LAB-COBAS-01)"
            value={deviceForm.code}
            onChange={(e) => setDeviceForm((p) => ({ ...p, code: e.target.value }))}
            required
          />
          <input
            placeholder="Department (e.g. LAB)"
            value={deviceForm.department}
            onChange={(e) => setDeviceForm((p) => ({ ...p, department: e.target.value }))}
          />
          <select
            value={deviceForm.machineType}
            onChange={(e) => setDeviceForm((p) => ({ ...p, machineType: e.target.value }))}
          >
            <option value="LAB_ANALYZER">LAB_ANALYZER</option>
            <option value="PACS">PACS</option>
            <option value="VITAL_MONITOR">VITAL_MONITOR</option>
            <option value="PHARMACY_DISPENSER">PHARMACY_DISPENSER</option>
            <option value="OTHER">OTHER</option>
          </select>
          <select
            value={deviceForm.protocol}
            onChange={(e) => setDeviceForm((p) => ({ ...p, protocol: e.target.value }))}
          >
            <option value="HL7">HL7</option>
            <option value="FHIR">FHIR</option>
            <option value="DICOM">DICOM</option>
            <option value="ASTM">ASTM</option>
            <option value="REST">REST</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
          <label className="profile-inline-checkbox">
            <input
              type="checkbox"
              checked={Boolean(deviceForm.capabilities.ingestLabResults)}
              onChange={(e) =>
                setDeviceForm((p) => ({
                  ...p,
                  capabilities: { ...p.capabilities, ingestLabResults: e.target.checked },
                }))
              }
            />
            Ingest Lab Results
          </label>
          <label className="profile-inline-checkbox">
            <input
              type="checkbox"
              checked={Boolean(deviceForm.capabilities.ingestVitals)}
              onChange={(e) =>
                setDeviceForm((p) => ({
                  ...p,
                  capabilities: { ...p.capabilities, ingestVitals: e.target.checked },
                }))
              }
            />
            Ingest Vitals
          </label>
          <label className="profile-inline-checkbox">
            <input
              type="checkbox"
              checked={Boolean(deviceForm.capabilities.ingestImaging)}
              onChange={(e) =>
                setDeviceForm((p) => ({
                  ...p,
                  capabilities: { ...p.capabilities, ingestImaging: e.target.checked },
                }))
              }
            />
            Ingest Imaging
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Registering..." : "Register Device"}
          </button>
        </form>
      </section>

      <section className="section" ref={devicesSectionRef}>
        <h3>Connected Devices</h3>
        <div className="card">
          <div className="table-wrap">
            <table className="table lite">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Protocol</th>
                  <th>Status</th>
                  <th>Last Heartbeat</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d._id}>
                    <td>{d.name}</td>
                    <td>{d.code}</td>
                    <td>{d.machineType}</td>
                    <td>{d.protocol}</td>
                    <td>{d.status}</td>
                    <td>{d.lastHeartbeatAt ? formatDateTime(d.lastHeartbeatAt) : "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn-secondary" onClick={() => setSelectedDeviceId(d._id)}>
                          Select
                        </button>
                        <button type="button" className="btn-secondary" disabled={saving} onClick={() => rotateKey(d._id)}>
                          Rotate Key
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => updateStatus(d._id, "MAINTENANCE")}>
                          Maintenance
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => updateStatus(d._id, "ONLINE")}>
                          Online
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {devices.length === 0 && (
                  <tr>
                    <td colSpan={7}>No machine devices registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>SLA & Reliability</h3>
        <div className="grid info-grid">
          <button type="button" className="card stat" onClick={() => scrollToSection(devicesSectionRef)}>
            <div className="card-title">Uptime %</div>
            <div className="card-value">{overview?.uptimePercent ?? "—"}</div>
          </button>
          <button
            type="button"
            className="card stat"
            onClick={() => {
              setAuditFilters((prev) => ({ ...prev, action: "HEARTBEAT" }));
              scrollToSection(auditSectionRef);
            }}
          >
            <div className="card-title">Heartbeat 24h</div>
            <div className="card-value">{overview?.heartbeat24h ?? "—"}</div>
          </button>
          <button type="button" className="card stat" onClick={() => scrollToSection(auditSectionRef)}>
            <div className="card-title">Ingestion Success 24h</div>
            <div className="card-value">{overview?.ingestionSuccess24h ?? "—"}</div>
          </button>
          <button type="button" className="card stat" onClick={() => scrollToSection(auditSectionRef)}>
            <div className="card-title">Ingestion Fail 24h</div>
            <div className="card-value">{overview?.ingestionFail24h ?? "—"}</div>
          </button>
          <button type="button" className="card stat" onClick={() => scrollToSection(testsSectionRef)}>
            <div className="card-title">Timeout Policy</div>
            <div className="card-value">{overview?.heartbeatTimeoutMinutes ?? "—"} min</div>
          </button>
        </div>
      </section>

      <section className="section" ref={testsSectionRef}>
        <h3>Connectivity Tests</h3>
        <form className="card form" onSubmit={testLabIngest}>
          <input
            placeholder="Machine Key (from register/rotate output)"
            value={testForm.machineKey}
            onChange={(e) => setTestForm((p) => ({ ...p, machineKey: e.target.value }))}
          />
          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={testHeartbeat} disabled={testing}>
              {testing ? "Testing..." : "Test Heartbeat"}
            </button>
          </div>
          <input
            placeholder="Lab Order ID"
            value={testForm.labOrderId}
            onChange={(e) => setTestForm((p) => ({ ...p, labOrderId: e.target.value }))}
          />
          <input
            placeholder="Test Name (optional check)"
            value={testForm.testName}
            onChange={(e) => setTestForm((p) => ({ ...p, testName: e.target.value }))}
          />
          <input
            placeholder="Patient ID (optional check)"
            value={testForm.patientId}
            onChange={(e) => setTestForm((p) => ({ ...p, patientId: e.target.value }))}
          />
          <input
            placeholder="External Result ID"
            value={testForm.externalResultId}
            onChange={(e) => setTestForm((p) => ({ ...p, externalResultId: e.target.value }))}
          />
          <textarea
            rows={4}
            placeholder='Result JSON e.g. {"HB":13.2,"WBC":7.4}'
            value={testForm.resultJson}
            onChange={(e) => setTestForm((p) => ({ ...p, resultJson: e.target.value }))}
          />
          <button type="submit" className="btn-primary" disabled={testing}>
            {testing ? "Submitting..." : "Test Lab Result Ingestion"}
          </button>
          {selectedDevice && (
            <p className="muted">
              Selected device: {selectedDevice.name} ({selectedDevice.code}) • {selectedDevice.protocol}
            </p>
          )}
        </form>
      </section>

      <section className="section">
        <h3>Readiness Blueprint</h3>
        <div className="grid info-grid">
          <button type="button" className="card stat" onClick={() => navigate("/system-admin/integration-hub")}>
            <div className="card-title">What Similar Projects Do</div>
            <div className="muted">
              Device registry, API keys, heartbeat monitoring, HL7/FHIR ingestion, audit trails.
            </div>
          </button>
          <button type="button" className="card stat" onClick={() => scrollToSection(registerSectionRef)}>
            <div className="card-title">What Hospitals Need</div>
            <div className="muted">
              Zero-downtime machine onboarding, controlled maintenance mode, result provenance,
              and quick failure detection.
            </div>
          </button>
          <button type="button" className="card stat" onClick={() => scrollToSection(protocolSectionRef)}>
            <div className="card-title">Future Features</div>
            <div className="muted">
              Device digital twins, predictive maintenance, edge buffering, ASTM/DICOM deep adapters,
              and auto-calibration alerts.
            </div>
          </button>
        </div>
      </section>

      <section className="section" ref={protocolSectionRef}>
        <h3>Protocol Test Tools</h3>
        <div className="grid info-grid">
          <div className="card form">
            <label>HL7 Simulator</label>
            <textarea
              rows={8}
              value={hl7Input}
              onChange={(e) => setHl7Input(e.target.value)}
              placeholder="Paste HL7 ORU/ADT payload"
            />
            <button type="button" className="btn-secondary" onClick={runHl7ParseTest} disabled={testing}>
              Parse HL7 Test
            </button>
            {hl7Output && (
              <pre className="card" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(hl7Output, null, 2)}
              </pre>
            )}
          </div>

          <div className="card form">
            <label>DICOM Stub Simulator</label>
            <input
              placeholder="Study UID (optional)"
              value={dicomForm.studyUid}
              onChange={(e) => setDicomForm((p) => ({ ...p, studyUid: e.target.value }))}
            />
            <select
              value={dicomForm.modality}
              onChange={(e) => setDicomForm((p) => ({ ...p, modality: e.target.value }))}
            >
              <option value="CT">CT</option>
              <option value="MRI">MRI</option>
              <option value="XRAY">XRAY</option>
              <option value="US">US</option>
              <option value="MAMMO">MAMMO</option>
            </select>
            <input
              placeholder="Patient ID"
              value={dicomForm.patientId}
              onChange={(e) => setDicomForm((p) => ({ ...p, patientId: e.target.value }))}
            />
            <input
              placeholder="Accession Number"
              value={dicomForm.accessionNumber}
              onChange={(e) => setDicomForm((p) => ({ ...p, accessionNumber: e.target.value }))}
            />
            <input
              placeholder="AET"
              value={dicomForm.aet}
              onChange={(e) => setDicomForm((p) => ({ ...p, aet: e.target.value }))}
            />
            <button type="button" className="btn-secondary" onClick={runDicomStubTest} disabled={testing}>
              Run DICOM Stub
            </button>
            {dicomOutput && (
              <pre className="card" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(dicomOutput, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </section>

      <section className="section" ref={auditSectionRef}>
        <h3>Machine Audit Trail</h3>
        <div className="card">
          <div className="welcome-actions" style={{ marginBottom: 10 }}>
            <select
              value={auditFilters.machineId}
              onChange={(e) => setAuditFilters((p) => ({ ...p, machineId: e.target.value }))}
            >
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
            <select
              value={auditFilters.action}
              onChange={(e) => setAuditFilters((p) => ({ ...p, action: e.target.value }))}
            >
              <option value="ALL">All actions</option>
              <option value="machine.register">machine.register</option>
              <option value="machine.update">machine.update</option>
              <option value="machine.rotate_key">machine.rotate_key</option>
              <option value="machine.heartbeat">machine.heartbeat</option>
              <option value="machine.lab_result.ingest">machine.lab_result.ingest</option>
              <option value="machine.lab_result.ingest_failed">machine.lab_result.ingest_failed</option>
            </select>
            <input
              type="date"
              value={auditFilters.from}
              onChange={(e) => setAuditFilters((p) => ({ ...p, from: e.target.value }))}
            />
            <input
              type="date"
              value={auditFilters.to}
              onChange={(e) => setAuditFilters((p) => ({ ...p, to: e.target.value }))}
            />
            <button type="button" className="btn-secondary" onClick={() => loadAudit(1)}>
              Refresh Audit
            </button>
          </div>

          <div className="table-wrap">
            <table className="table lite">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Machine</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.createdAt ? formatDateTime(row.createdAt) : "-"}</td>
                    <td>{row.action}</td>
                    <td>{row?.details?.code || row?.details?.machineId || "-"}</td>
                    <td>
                      <code>{JSON.stringify(row?.details || {})}</code>
                    </td>
                    <td>{row.ip || "-"}</td>
                  </tr>
                ))}
                {auditRows.length === 0 && (
                  <tr>
                    <td colSpan={5}>No machine audit events found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadAudit(Math.max(1, auditPage - 1))}
              disabled={auditPage <= 1}
            >
              Prev
            </button>
            <span className="muted">
              Page {auditPage} • {auditTotal} events
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadAudit(auditPage + 1)}
              disabled={auditPage * 20 >= auditTotal}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
