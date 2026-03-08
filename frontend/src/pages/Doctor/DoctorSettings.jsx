import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildDefaultRows() {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "08:00",
    endTime: "17:00",
    appointmentSlots: 12,
    isAvailable: true,
    consultationAvailable: true,
    modes: {
      chat: true,
      voice: false,
      video: false,
      inPerson: true,
    },
    notes: "",
  }));
}

export default function DoctorSettings() {
  const { user } = useAuth();
  const [rows, setRows] = useState(buildDefaultRows());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const todayIndex = new Date().getDay();
  const todayRow = useMemo(
    () => rows.find((row) => Number(row.dayOfWeek) === todayIndex) || null,
    [rows, todayIndex]
  );

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch(`/api/appointments/doctors/${user.id}/availability`);
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items.length ? items : buildDefaultRows());
    } catch (err) {
      setRows(buildDefaultRows());
      setMsg(err?.message || "Could not load your schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const patchRow = (index, updates) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  };

  const patchModes = (index, key, value) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, modes: { ...(row.modes || {}), [key]: value } } : row
      )
    );
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    setMsg("");
    try {
      await apiFetch(`/api/appointments/doctors/${user.id}/availability`, {
        method: "PUT",
        body: {
          items: rows,
        },
      });
      setMsg("Availability saved.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not save availability.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard doctor-workspace">
      <div className="welcome-panel">
        <div>
          <h2>Doctor Settings</h2>
          <p className="muted">Set clinic hours, appointment capacity, and which consultation modes are open.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Today</h3>
        <div className="grid info-grid">
          <div className="card stat">
            <div className="card-title">Day</div>
            <div className="card-value">{DAY_NAMES[todayIndex]}</div>
          </div>
          <div className="card stat">
            <div className="card-title">Schedule</div>
            <div className="card-value">
              {todayRow ? `${todayRow.startTime} - ${todayRow.endTime}` : "Closed"}
            </div>
          </div>
          <div className="card stat">
            <div className="card-title">Booking</div>
            <div className="card-value">
              {todayRow?.isAvailable === false ? "Closed" : "Open"}
            </div>
          </div>
          <div className="card stat">
            <div className="card-title">Consultations</div>
            <div className="card-value">
              {todayRow?.consultationAvailable === false ? "Closed" : "Open"}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Weekly Availability</h3>
        <div className="card premium-card">
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Slots</th>
                  <th>Bookings</th>
                  <th>Consults</th>
                  <th>Modes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.dayOfWeek}-${index}`}>
                    <td>{DAY_NAMES[row.dayOfWeek] || row.dayOfWeek}</td>
                    <td>
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(e) => patchRow(index, { startTime: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(e) => patchRow(index, { endTime: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="96"
                        value={row.appointmentSlots}
                        onChange={(e) =>
                          patchRow(index, { appointmentSlots: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.isAvailable !== false}
                        onChange={(e) => patchRow(index, { isAvailable: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.consultationAvailable !== false}
                        onChange={(e) =>
                          patchRow(index, { consultationAvailable: e.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <div className="profile-actions-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={row?.modes?.inPerson !== false}
                            onChange={(e) => patchModes(index, "inPerson", e.target.checked)}
                          />{" "}
                          In person
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={row?.modes?.chat !== false}
                            onChange={(e) => patchModes(index, "chat", e.target.checked)}
                          />{" "}
                          Chat
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={row?.modes?.voice === true}
                            onChange={(e) => patchModes(index, "voice", e.target.checked)}
                          />{" "}
                          Voice
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={row?.modes?.video === true}
                            onChange={(e) => patchModes(index, "video", e.target.checked)}
                          />{" "}
                          Video
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
