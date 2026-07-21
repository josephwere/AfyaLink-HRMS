import React, { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import EditableSection from "../../components/EditableSection";
import ContentSkeleton from "../../components/ContentSkeleton";
import { showActionSuccessGuide } from "../../components/ActionSuccessGuide";
import { useDoctorAvailability } from "../../hooks/useDoctorAvailability";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DoctorSettings() {
  const navigate = useNavigate();
  const weeklySectionRef = useRef(null);
  const {
    rows,
    loading,
    saving,
    msg,
    availabilitySaved,
    availabilityEditing,
    setAvailabilityEditing,
    todayIndex,
    todayRow,
    patchRow,
    patchModes,
    load,
    save,
  } = useDoctorAvailability();

  const handleSave = async () => {
    const ok = await save();
    if (ok !== false) {
      showActionSuccessGuide({
        title: "Availability Saved",
        message: "Your consultation schedule and booking capacity have been updated.",
        icon: "✓",
        nextActions: [
          { label: "View Schedule", path: "/doctor/schedule" },
          {
            label: "Ask AI",
            action: "ai",
            aiPrompt: "Review my weekly doctor availability and suggest how I can reduce patient waiting time.",
            variant: "secondary",
          },
        ],
        notificationCategory: "ACCOUNT",
      });
    }
  };

  const openWeeklyAvailability = () => {
    weeklySectionRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}
      {loading ? <ContentSkeleton variant="table" title="Loading doctor availability" rows={3} /> : null}

      {!loading ? (
        <>
          <section className="section">
            <h3>Today</h3>
            <div className="grid info-grid">
              <StatCard title="Day" value={DAY_NAMES[todayIndex]} onClick={openWeeklyAvailability} />
              <StatCard
                title="Schedule"
                value={todayRow ? `${todayRow.startTime} - ${todayRow.endTime}` : "Closed"}
                onClick={openWeeklyAvailability}
              />
              <StatCard
                title="Booking"
                value={todayRow?.isAvailable === false ? "Closed" : "Open"}
                onClick={openWeeklyAvailability}
              />
              <StatCard
                title="Consultations"
                value={todayRow?.consultationAvailable === false ? "Closed" : "Open"}
                onClick={() => navigate("/doctor/schedule")}
              />
            </div>
          </section>

          <section className="section" ref={weeklySectionRef}>
            <EditableSection
              title="Weekly Availability"
              eyebrow="Doctor"
              description="Set clinic hours, appointment capacity, and consultation channels."
              saved={availabilitySaved}
              editing={availabilityEditing}
              saving={saving}
              onEdit={() => setAvailabilityEditing(true)}
              onSave={handleSave}
              onCancel={() => setAvailabilityEditing(false)}
              saveLabel="Save Availability"
              aside={<span className="action-pill">{availabilitySaved && !availabilityEditing ? "Locked" : "Editable"}</span>}
            >
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
            </EditableSection>
          </section>
        </>
      ) : null}
    </div>
  );
}
