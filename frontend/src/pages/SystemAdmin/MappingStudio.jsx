import React from "react";
import { useMappingStudio } from "../../hooks/useMappingStudio";

export default function MappingStudio() {
  const {
    mappings,
    templates,
    form,
    setForm,
    editingId,
    format,
    setFormat,
    previewPayload,
    setPreviewPayload,
    selectedMappingId,
    setSelectedMappingId,
    previewResult,
    signatureInput,
    setSignatureInput,
    verifyInput,
    setVerifyInput,
    verifyResult,
    msg,
    loading,
    parsedMapping,
    load,
    resetForm,
    save,
    edit,
    remove,
    runPreview,
    runSign,
    runVerify,
  } = useMappingStudio();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>FHIR/HL7 Transformation Studio</h2>
          <p className="muted">Create mappings, preview transformations, and verify signed provenance.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={() => void save()}>{editingId ? "Update Mapping" : "Save Mapping"}</button>
            <button type="button" className="btn-secondary" onClick={resetForm}>Reset</button>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={() => void runPreview()}>Preview Transform</button>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-secondary" onClick={() => void runSign()}>Sign Payload</button>
            <button type="button" className="btn-secondary" onClick={() => void runVerify()}>Verify Signature</button>
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
                    <button type="button" className="btn-secondary" onClick={() => edit(m)}>Edit</button>
                    <button type="button" className="btn-danger" onClick={() => void remove(m._id)}>Delete</button>
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

