import React, { useEffect, useMemo, useState } from "react";
import {
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  listMappingTemplates,
  previewMapping,
  signMappingPayload,
  verifyMappingPayload,
} from "../../services/mappingStudioApi";

const DEFAULT_FORM = {
  messageType: "ORM^O01",
  sourceSystem: "LIS",
  targetSystem: "EMR",
  mappingJson: JSON.stringify(
    {
      "PID-5": "patient.name",
      "PID-7": "patient.dateOfBirth",
      "OBR-4": "order.testCode",
    },
    null,
    2
  ),
};

export default function MappingStudio() {
  const [mappings, setMappings] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [format, setFormat] = useState("HL7");
  const [previewPayload, setPreviewPayload] = useState(
    "MSH|^~\\&|LIS|HOSP|EMR|HOSP|20260220||ORM^O01|123|P|2.3\nPID|1||P001||Jane Doe||1988-02-02\nOBR|1|||CBC^Panel"
  );
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [previewResult, setPreviewResult] = useState(null);
  const [signatureInput, setSignatureInput] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const parsedMapping = useMemo(() => {
    try {
      return JSON.parse(form.mappingJson || "{}");
    } catch {
      return null;
    }
  }, [form.mappingJson]);

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [rows, tpls] = await Promise.all([listMappings(), listMappingTemplates()]);
      setMappings(Array.isArray(rows) ? rows : []);
      setTemplates(Array.isArray(tpls?.templates) ? tpls.templates : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load mapping studio");
      setMappings([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setMsg("");
    if (!parsedMapping) {
      setMsg("Mapping JSON is invalid.");
      return;
    }
    try {
      const payload = {
        messageType: form.messageType,
        sourceSystem: form.sourceSystem,
        targetSystem: form.targetSystem,
        mapping: parsedMapping,
      };
      if (editingId) {
        await updateMapping(editingId, payload);
        setMsg("Mapping updated.");
      } else {
        await createMapping(payload);
        setMsg("Mapping created.");
      }
      setForm(DEFAULT_FORM);
      setEditingId(null);
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to save mapping");
    }
  };

  const edit = (row) => {
    setEditingId(row._id);
    setForm({
      messageType: row.messageType || "",
      sourceSystem: row.sourceSystem || "",
      targetSystem: row.targetSystem || "",
      mappingJson: JSON.stringify(row.mapping || {}, null, 2),
    });
  };

  const remove = async (id) => {
    setMsg("");
    try {
      await deleteMapping(id);
      setMsg("Mapping deleted.");
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to delete mapping");
    }
  };

  const runPreview = async () => {
    setMsg("");
    setPreviewResult(null);
    try {
      const payload = {
        format,
        payload: format === "FHIR" ? JSON.parse(previewPayload || "{}") : previewPayload,
        ...(selectedMappingId ? { mappingId: selectedMappingId } : { mapping: parsedMapping || {} }),
      };
      const out = await previewMapping(payload);
      setPreviewResult(out || null);
      if (out?.provenance?.signature) setVerifyInput(out.provenance.signature);
    } catch (e) {
      setMsg(e?.message || "Preview failed");
    }
  };

  const runSign = async () => {
    setMsg("");
    try {
      const payloadObj = JSON.parse(signatureInput || "{}");
      const out = await signMappingPayload({ payload: payloadObj, context: { module: "mapping_studio_ui" } });
      setVerifyInput(out?.signature?.signature || "");
      setMsg("Payload signed.");
    } catch (e) {
      setMsg(e?.message || "Sign failed");
    }
  };

  const runVerify = async () => {
    setMsg("");
    setVerifyResult(null);
    try {
      const payloadObj = JSON.parse(signatureInput || "{}");
      const out = await verifyMappingPayload({ payload: payloadObj, signature: verifyInput });
      setVerifyResult(out?.verification || null);
    } catch (e) {
      setMsg(e?.message || "Verify failed");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>FHIR/HL7 Transformation Studio</h2>
          <p className="muted">Create mappings, preview transformations, and verify signed provenance.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>{editingId ? "Edit Mapping" : "Create Mapping"}</h3>
        <div className="card">
          <div className="grid info-grid">
            <label>
              Message Type
              <input value={form.messageType} onChange={(e) => setForm((p) => ({ ...p, messageType: e.target.value }))} />
            </label>
            <label>
              Source System
              <input value={form.sourceSystem} onChange={(e) => setForm((p) => ({ ...p, sourceSystem: e.target.value }))} />
            </label>
            <label>
              Target System
              <input value={form.targetSystem} onChange={(e) => setForm((p) => ({ ...p, targetSystem: e.target.value }))} />
            </label>
          </div>
          <label>
            Mapping JSON
            <textarea rows={10} value={form.mappingJson} onChange={(e) => setForm((p) => ({ ...p, mappingJson: e.target.value }))} />
          </label>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={save}>{editingId ? "Update Mapping" : "Save Mapping"}</button>
            <button className="btn-secondary" onClick={() => { setForm(DEFAULT_FORM); setEditingId(null); }}>Reset</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Preview + Provenance</h3>
        <div className="card">
          <div className="grid info-grid">
            <label>
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="HL7">HL7</option>
                <option value="FHIR">FHIR</option>
              </select>
            </label>
            <label>
              Use saved mapping
              <select value={selectedMappingId} onChange={(e) => setSelectedMappingId(e.target.value)}>
                <option value="">Current editor mapping</option>
                {mappings.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.messageType} / {m.sourceSystem} → {m.targetSystem}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Source payload ({format})
            <textarea rows={8} value={previewPayload} onChange={(e) => setPreviewPayload(e.target.value)} />
          </label>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={runPreview}>Preview Transform</button>
          </div>
          {previewResult && (
            <details style={{ marginTop: 10 }} open>
              <summary>Preview Result</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(previewResult, null, 2)}</pre>
            </details>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Signature Tools</h3>
        <div className="card">
          <label>
            Payload JSON
            <textarea rows={6} value={signatureInput} onChange={(e) => setSignatureInput(e.target.value)} />
          </label>
          <label>
            Signature
            <input value={verifyInput} onChange={(e) => setVerifyInput(e.target.value)} />
          </label>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-secondary" onClick={runSign}>Sign Payload</button>
            <button className="btn-secondary" onClick={runVerify}>Verify Signature</button>
          </div>
          {verifyResult && (
            <div className="card" style={{ marginTop: 10 }}>
              Verification: <strong>{verifyResult.valid ? "VALID" : "INVALID"}</strong> ({verifyResult.reason})
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Saved Mappings</h3>
        <div className="card">
          <table className="table lite">
            <thead>
              <tr>
                <th>Type</th>
                <th>Source</th>
                <th>Target</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m._id}>
                  <td>{m.messageType}</td>
                  <td>{m.sourceSystem}</td>
                  <td>{m.targetSystem}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => edit(m)}>Edit</button>
                    <button className="btn-danger" onClick={() => remove(m._id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {mappings.length === 0 && (
                <tr>
                  <td colSpan="4">No mappings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h3>Template Catalog</h3>
        <div className="panel-grid">
          {templates.map((t) => (
            <div className="card" key={t.id}>
              <strong>{t.title}</strong>
              <p className="muted">{t.format}</p>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(t.mapping, null, 2)}</pre>
            </div>
          ))}
          {templates.length === 0 && <div className="card muted">No templates.</div>}
        </div>
      </section>
    </div>
  );
}

