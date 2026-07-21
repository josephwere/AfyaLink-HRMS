import { useCommunicationCenter } from "../../hooks/useCommunicationCenter";

export default function CommunicationCenter() {
  const {
    channels,
    activeChannel,
    setActiveChannel,
    messages,
    nextCursor,
    draft,
    setDraft,
    msg,
    loading,
    pendingOffline,
    current,
    bootstrapDefaultChannels,
    loadMessages,
    send,
  } = useCommunicationCenter();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Communication Center</h2>
          <p className="muted">
            Real-time hospital channels for doctor-lab, lab-pharmacy, nurse-doctor, security-reception and operations.
          </p>
          <p className="muted">Offline queued messages: {pendingOffline}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={bootstrapDefaultChannels}>
            Bootstrap Default Channels
          </button>
        </div>
      </div>

      <section className="section">
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="card premium-card">
            <h3>Channels</h3>
            <div className="list">
              {channels.map((ch) => (
                <button
                  type="button"
                  key={ch._id}
                  className={`nav-btn ${String(activeChannel) === String(ch._id) ? "active" : ""}`}
                  onClick={() => setActiveChannel(ch._id)}
                >
                  {ch.name}
                </button>
              ))}
              {channels.length === 0 && <p className="muted">No channels yet.</p>}
            </div>
          </div>

          <div className="card premium-card">
            <h3>{current?.name || "Messages"}</h3>
            <div className="muted" style={{ marginBottom: 8 }}>
              {current?.description || "Select a channel"}
            </div>

            <div className="message-stack" style={{ maxHeight: 360, overflow: "auto" }}>
              {messages.map((m) => (
                <div key={m._id} className="card" style={{ marginBottom: 8 }}>
                  <div className="muted">
                    <strong>{m.sender?.name || "Unknown"}</strong> • {m.senderRole} •{" "}
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                  <div>{m.body}</div>
                </div>
              ))}
              {!loading && messages.length === 0 && (
                <p className="muted">No messages in this channel.</p>
              )}
            </div>

            <div className="actions-row mt-10">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <button type="button" className="btn-primary" onClick={send} disabled={!activeChannel}>
                Send
              </button>
            </div>
            {nextCursor && (
              <div style={{ marginTop: 8 }}>
                <button type="button"
                  className="btn-secondary"
                  onClick={() => loadMessages(activeChannel, nextCursor, true)}
                >
                  Load older
                </button>
              </div>
            )}
          </div>
        </div>
        {msg ? <p className="muted">{msg}</p> : null}
      </section>
    </div>
  );
}
