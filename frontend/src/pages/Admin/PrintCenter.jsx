import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../utils/auth";
import {
  createPrinterProfile,
  getPrintingConnectors,
  listPrinterProfiles,
  listPrintJobs,
  printHtmlDocument,
  queuePrintJob,
  updatePrinterProfile,
  updatePrintJobStatus,
} from "../../services/printingApi";

const DEFAULT_FORM = {
  name: "",
  provider: "BROWSER",
  location: "",
  description: "",
  isDefault: false,
  enabled: true,
  config: {
    ippUrl: "",
    queueName: "",
    paperSize: "A4",
    duplex: false,
    color: true,
    copiesDefault: 1,
  },
};

export default function PrintCenter() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [connectors, setConnectors] = useState(null);
  const [profileForm, setProfileForm] = useState(DEFAULT_FORM);
  const [testTitle, setTestTitle] = useState("AfyaLink Test Print");
  const [testBody, setTestBody] = useState("This is a printer connectivity test.");
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canManageProfiles = useMemo(() => {
    const role = String(user?.actualRole || user?.role || "").toUpperCase();
    return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  }, [user]);

  const load = async () => {
    const [p, j, c] = await Promise.all([
      listPrinterProfiles().catch(() => ({ items: [] })),
      listPrintJobs({ limit: 50 }).catch(() => ({ items: [] })),
      getPrintingConnectors().catch(() => ({ connectors: {} })),
    ]);
    const items = p?.items || [];
    setProfiles(items);
    setJobs(j?.items || []);
    setConnectors(c?.connectors || {});
    setSelectedPrinterId((prev) => prev || items.find((x) => x.isDefault)?._id || items[0]?._id || "");
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!canManageProfiles) return;
    setBusy(true);
    setMsg("");
    try {
      await createPrinterProfile(profileForm);
      setProfileForm(DEFAULT_FORM);
      setMsg("Printer profile saved.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save printer profile");
    } finally {
      setBusy(false);
    }
  };

  const togglePrinter = async (item, patch) => {
    setBusy(true);
    setMsg("");
    try {
      await updatePrinterProfile(item._id, patch);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to update printer");
    } finally {
      setBusy(false);
    }
  };

  const queueTestPrint = async () => {
    if (!selectedPrinterId) {
      setMsg("Select printer profile first.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await queuePrintJob({
        printerProfileId: selectedPrinterId,
        documentType: "GENERAL",
        title: testTitle,
        payload: {
          text: testBody,
          createdBy: user?.name || user?.email || "Unknown",
          createdAt: new Date().toISOString(),
        },
      });
      setMsg(`Print job queued: ${res?.job?._id || "ok"}`);
      if (res?.printableHtml) {
        printHtmlDocument(res.printableHtml, testTitle);
      }
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to queue print test");
    } finally {
      setBusy(false);
    }
  };

  const updateJob = async (id, status) => {
    setBusy(true);
    setMsg("");
    try {
      await updatePrintJobStatus(id, { status });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to update job");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Print Center</h2>
          <p className="muted">
            Manage printers, queue jobs, and print clinical/admin paperwork.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={() => window.print()}>Print Current Page</button>
        </div>
      </div>

      {msg ? <div className="card"><p className="muted">{msg}</p></div> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Connectors</h3>
          <div className="alert-stack">
            <div className="alert-item">Browser print: {connectors?.browser?.enabled ? "Enabled" : "Disabled"}</div>
            <div className="alert-item">PDF output: {connectors?.pdf?.enabled ? "Enabled" : "Disabled"}</div>
            <div className="alert-item">QZ Tray bridge: {connectors?.qzTray?.enabled ? "Configured" : "Not configured"}</div>
            <div className="alert-item">CUPS bridge: {connectors?.cups?.enabled ? "Configured" : "Not configured"}</div>
            <div className="alert-item">IPP profiles: {connectors?.ipp?.enabled ? "Supported" : "Disabled"}</div>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Quick Test Print</h3>
          <div className="grid info-grid">
            <select value={selectedPrinterId} onChange={(e) => setSelectedPrinterId(e.target.value)}>
              <option value="">Select printer profile</option>
              {profiles.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.provider}){p.isDefault ? " • default" : ""}
                </option>
              ))}
            </select>
            <input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Document title" />
            <textarea value={testBody} onChange={(e) => setTestBody(e.target.value)} placeholder="Document content" />
            <button className="btn-primary" onClick={queueTestPrint} disabled={busy || !selectedPrinterId}>
              Queue + Print
            </button>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Printer Profiles</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p._id}>
                    <td>{p.name}{p.isDefault ? " • default" : ""}</td>
                    <td>{p.provider}</td>
                    <td>{p.location || "-"}</td>
                    <td>{p.enabled ? "Enabled" : "Disabled"}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="btn-secondary" onClick={() => togglePrinter(p, { enabled: !p.enabled })}>
                          {p.enabled ? "Disable" : "Enable"}
                        </button>
                        <button className="btn-secondary" onClick={() => togglePrinter(p, { isDefault: true })}>
                          Set Default
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!profiles.length ? (
                  <tr><td colSpan={5}>No printer profiles yet</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Add Printer Profile</h3>
          <form className="grid info-grid" onSubmit={saveProfile}>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Printer name"
              required
              disabled={!canManageProfiles}
            />
            <select
              value={profileForm.provider}
              onChange={(e) => setProfileForm((p) => ({ ...p, provider: e.target.value }))}
              disabled={!canManageProfiles}
            >
              <option value="BROWSER">Browser</option>
              <option value="PDF">PDF</option>
              <option value="IPP">IPP</option>
              <option value="QZ_TRAY">QZ Tray</option>
              <option value="CUPS">CUPS</option>
            </select>
            <input
              value={profileForm.location}
              onChange={(e) => setProfileForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="Location (e.g. Reception)"
              disabled={!canManageProfiles}
            />
            <input
              value={profileForm.config.ippUrl}
              onChange={(e) => setProfileForm((p) => ({ ...p, config: { ...p.config, ippUrl: e.target.value } }))}
              placeholder="IPP URL / connector address"
              disabled={!canManageProfiles}
            />
            <input
              value={profileForm.config.queueName}
              onChange={(e) => setProfileForm((p) => ({ ...p, config: { ...p.config, queueName: e.target.value } }))}
              placeholder="Queue / driver name"
              disabled={!canManageProfiles}
            />
            <button className="btn-primary" type="submit" disabled={busy || !canManageProfiles}>Save Profile</button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Print Job History</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Printer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j._id}>
                    <td>{new Date(j.createdAt).toLocaleString()}</td>
                    <td>{j.title || "-"}</td>
                    <td>{j.documentType}</td>
                    <td>{j.printerProfile?.name || "-"}</td>
                    <td>{j.status}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="btn-secondary" onClick={() => updateJob(j._id, "PRINTED")}>Mark Printed</button>
                        <button className="btn-secondary" onClick={() => updateJob(j._id, "FAILED")}>Mark Failed</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!jobs.length ? <tr><td colSpan={6}>No print jobs</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

