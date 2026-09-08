import { useHospitalCommunicationCenter } from "../../hooks/useHospitalCommunicationCenter";

export default function HospitalAdminCenter() {
  const {
    isHospitalAdmin,
    templates,
    broadcasts,
    logs,
    analytics,
    loading,
    message,
    eventType,
    setEventType,
    channel,
    setChannel,
    subject,
    setSubject,
    body,
    setBody,
    eventOptions,
    channelOptions,
    audienceOptions,
    broadcastTitle,
    setBroadcastTitle,
    broadcastMessage,
    setBroadcastMessage,
    broadcastAudience,
    broadcastChannels,
    scheduledAt,
    setScheduledAt,
    saveTemplate,
    createBroadcast,
    sendBroadcast,
    toggleAudience,
    toggleChannel,
  } = useHospitalCommunicationCenter();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Communication Center</h2>
          <p className="muted">
            Hospital-specific email, SMS, push, and broadcast governance with default template fallback.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="card premium-card mt-10">
          <h3>Communication Analytics</h3>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="card"><strong>{analytics.messagesSent}</strong><div className="muted">Messages Sent</div></div>
            <div className="card"><strong>{analytics.emailsDelivered}</strong><div className="muted">Emails Delivered</div></div>
            <div className="card"><strong>{analytics.smsDelivered}</strong><div className="muted">SMS Delivered</div></div>
            <div className="card"><strong>{analytics.pushDelivered}</strong><div className="muted">Push Delivered</div></div>
            <div className="card"><strong>{analytics.readRate}%</strong><div className="muted">Read Rate</div></div>
            <div className="card"><strong>{analytics.openRate}%</strong><div className="muted">Open Rate</div></div>
            <div className="card"><strong>{analytics.clickRate}%</strong><div className="muted">Click Rate</div></div>
            <div className="card"><strong>{analytics.failedDeliveries}</strong><div className="muted">Failed Deliveries</div></div>
            <div className="card"><strong>{analytics.queuedMessages}</strong><div className="muted">Queued Messages</div></div>
          </div>
        </div>

        <div className="card premium-card">
          <h3>Communication Templates</h3>
          <div className="grid-2" style={{ gap: 12 }}>
            <label>
              <div className="muted">Event</div>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {eventOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label>
              <div className="muted">Channel</div>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                {channelOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-10">
            <div className="muted">Subject</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Optional subject" />
          </label>

          <label className="mt-10">
            <div className="muted">Body</div>
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type the template body with placeholders like {{patientName}}"
            />
          </label>

          <div className="actions-row mt-10">
            <button type="button" className="btn-primary" onClick={saveTemplate} disabled={!isHospitalAdmin || loading}>
              Save Hospital Template
            </button>
          </div>

          <div className="mt-10">
            <div className="muted">Saved templates</div>
            {templates.length === 0 ? (
              <p className="muted">No hospital templates yet. The system will use platform defaults.</p>
            ) : (
              <div className="list">
                {templates.map((item) => (
                  <div key={item._id} className="card" style={{ marginBottom: 8 }}>
                    <strong>{item.eventType}</strong> • {item.channel}
                    <div className="muted">{item.subject || "(no subject)"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card premium-card mt-10">
          <h3>Broadcast Messages</h3>
          <label>
            <div className="muted">Title</div>
            <input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="New CT Scan Machine" />
          </label>
          <label className="mt-10">
            <div className="muted">Message</div>
            <textarea rows={5} value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Type your hospital broadcast message" />
          </label>

          <div className="grid-2 mt-10" style={{ gap: 12 }}>
            <label>
              <div className="muted">Schedule</div>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
          </div>

          <div className="mt-10">
            <div className="muted">Audience</div>
            <div className="list">
              {audienceOptions.map((option) => (
                <label key={option} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={broadcastAudience.includes(option)}
                    onChange={() => toggleAudience(option)}
                  />
                  {" "}{option}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <div className="muted">Channels</div>
            <div className="list">
              {channelOptions.map((option) => (
                <label key={option} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={broadcastChannels.includes(option)}
                    onChange={() => toggleChannel(option)}
                  />
                  {" "}{option}
                </label>
              ))}
            </div>
          </div>

          <div className="actions-row mt-10">
            <button type="button" className="btn-primary" onClick={createBroadcast} disabled={!isHospitalAdmin || loading}>
              Save Broadcast
            </button>
          </div>

          <div className="mt-10">
            <div className="muted">Broadcasts</div>
            {broadcasts.length === 0 ? (
              <p className="muted">No broadcast records yet.</p>
            ) : (
              <div className="list">
                {broadcasts.map((item) => (
                  <div key={item._id} className="card" style={{ marginBottom: 8 }}>
                    <strong>{item.title}</strong>
                    <div className="muted">Status: {item.status}</div>
                    <div className="muted">Audience: {item.audience.join(", ")}</div>
                    <button type="button" className="btn-secondary" onClick={() => sendBroadcast(item._id)}>
                      Send Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card premium-card mt-10">
          <h3>Delivery History</h3>
          {logs.length === 0 ? (
            <p className="muted">No delivery logs yet.</p>
          ) : (
            <div className="list">
              {logs.map((item) => (
                <div key={item._id} className="card" style={{ marginBottom: 8 }}>
                  <strong>{item.eventType}</strong> • {item.channel}
                  <div className="muted">Status: {item.deliveryStatus}</div>
                  <div className="muted">{item.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {message ? <p className="muted mt-10">{message}</p> : null}
      </section>
    </div>
  );
}
