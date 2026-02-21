import { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { useSocket } from "../../utils/socket";
import {
  enqueueOfflineAction,
  listOfflineActions,
  startOfflineAutoSync,
} from "../../utils/offlineQueue";

export default function CommunicationCenter() {
  const socket = useSocket();
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState("");
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOffline, setPendingOffline] = useState(0);

  const current = useMemo(
    () => channels.find((c) => String(c._id) === String(activeChannel)) || null,
    [channels, activeChannel]
  );

  const loadChannels = async () => {
    try {
      const data = await apiFetch("/api/communication/channels");
      const list = Array.isArray(data?.items) ? data.items : [];
      setChannels(list);
      if (!activeChannel && list[0]) setActiveChannel(list[0]._id);
    } catch (err) {
      setMsg(err.message || "Failed to load channels");
    }
  };

  const bootstrapDefaultChannels = async () => {
    setMsg("");
    try {
      await apiFetch("/api/communication/bootstrap", { method: "POST" });
      await loadChannels();
      setMsg("Default communication channels created.");
    } catch (err) {
      setMsg(err.message || "Failed to bootstrap channels");
    }
  };

  const loadMessages = async (channelId, cursor = null, append = false) => {
    if (!channelId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (cursor) qs.set("cursor", cursor);
      qs.set("limit", "30");
      const data = await apiFetch(`/api/communication/channels/${channelId}/messages?${qs}`);
      const list = Array.isArray(data?.items) ? data.items : [];
      setNextCursor(data?.nextCursor || null);
      setMessages((prev) => (append ? [...prev, ...list] : list));
    } catch (err) {
      setMsg(err.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeChannel) return;
    setMsg("");
    try {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          feature: "COMMUNICATION",
          path: `/api/communication/channels/${activeChannel}/messages`,
          method: "POST",
          body: { body: text },
        });
        setDraft("");
        setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
        setMsg("Offline: message queued and will sync automatically.");
        return;
      }
      await apiFetch(`/api/communication/channels/${activeChannel}/messages`, {
        method: "POST",
        body: { body: text },
      });
      setDraft("");
      await loadMessages(activeChannel, null, false);
    } catch (err) {
      const textMsg = String(err.message || "");
      if (textMsg.toLowerCase().includes("network")) {
        enqueueOfflineAction({
          feature: "COMMUNICATION",
          path: `/api/communication/channels/${activeChannel}/messages`,
          method: "POST",
          body: { body: text },
        });
        setDraft("");
        setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
        setMsg("Network unavailable: message queued for sync.");
      } else {
        setMsg(textMsg || "Failed to send message");
      }
    }
  };

  useEffect(() => {
    loadChannels();
    setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
  }, []);

  useEffect(() => {
    const stop = startOfflineAutoSync(async (item) => {
      await apiFetch(item.path, {
        method: item.method,
        body: item.body,
        _skipOfflineQueue: true,
      });
      if (item.feature === "COMMUNICATION") {
        setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
      }
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    if (!socket || !activeChannel) return;
    socket.emit("communication:join", { channelId: activeChannel });
    const onMsg = (data) => {
      if (String(data?.channel) === String(activeChannel)) {
        setMessages((prev) => [data, ...prev]);
      }
    };
    socket.on("communication:message", onMsg);
    return () => {
      socket.emit("communication:leave", { channelId: activeChannel });
      socket.off("communication:message", onMsg);
    };
  }, [socket, activeChannel]);

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
          <button className="btn-secondary" onClick={bootstrapDefaultChannels}>
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

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <button className="btn-primary" onClick={send} disabled={!activeChannel}>
                Send
              </button>
            </div>
            {nextCursor && (
              <div style={{ marginTop: 8 }}>
                <button
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
