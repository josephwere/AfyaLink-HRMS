import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocket } from "../utils/socket";
import {
  bootstrapCommunicationChannels,
  listCommunicationChannels,
  listCommunicationMessages,
  sendCommunicationMessage,
} from "../services/communicationApi";
import {
  enqueueOfflineAction,
  listOfflineActions,
  startOfflineAutoSync,
} from "../utils/offlineQueue";

export function useCommunicationCenter() {
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

  const loadChannels = useCallback(async () => {
    try {
      const data = await listCommunicationChannels();
      const list = Array.isArray(data?.items) ? data.items : [];
      setChannels(list);
      if (!activeChannel && list[0]) setActiveChannel(list[0]._id);
    } catch (err) {
      setMsg(err.message || "Failed to load channels");
    }
  }, [activeChannel]);

  const bootstrapDefaultChannels = useCallback(async () => {
    setMsg("");
    try {
      await bootstrapCommunicationChannels();
      await loadChannels();
      setMsg("Default communication channels created.");
    } catch (err) {
      setMsg(err.message || "Failed to bootstrap channels");
    }
  }, [loadChannels]);

  const loadMessages = useCallback(async (channelId, cursor = null, append = false) => {
    if (!channelId) return;
    setLoading(true);
    try {
      const data = await listCommunicationMessages(channelId, cursor);
      const list = Array.isArray(data?.items) ? data.items : [];
      setNextCursor(data?.nextCursor || null);
      setMessages((prev) => (append ? [...prev, ...list] : list));
    } catch (err) {
      setMsg(err.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activeChannel) return;
    setMsg("");
    try {
      if (!navigator.onLine) {
        enqueueOfflineAction({ feature: "COMMUNICATION", path: `/api/communication/channels/${activeChannel}/messages`, method: "POST", body: { body: text } });
        setDraft("");
        setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
        setMsg("Offline: message queued and will sync automatically.");
        return;
      }
      await sendCommunicationMessage(activeChannel, { body: text });
      setDraft("");
      await loadMessages(activeChannel, null, false);
    } catch (err) {
      const textMsg = String(err.message || "");
      if (textMsg.toLowerCase().includes("network")) {
        enqueueOfflineAction({ feature: "COMMUNICATION", path: `/api/communication/channels/${activeChannel}/messages`, method: "POST", body: { body: text } });
        setDraft("");
        setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
        setMsg("Network unavailable: message queued for sync.");
      } else {
        setMsg(textMsg || "Failed to send message");
      }
    }
  }, [activeChannel, draft, loadMessages]);

  useEffect(() => {
    void loadChannels();
    setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
  }, [loadChannels]);

  useEffect(() => {
    const stop = startOfflineAutoSync(async (item) => {
      await sendCommunicationMessage(item.path.split("/").slice(-2)[0], item.body);
      if (item.feature === "COMMUNICATION") {
        setPendingOffline(listOfflineActions().filter((a) => a.feature === "COMMUNICATION").length);
      }
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    void loadMessages(activeChannel);
  }, [activeChannel, loadMessages]);

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

  return {
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
    loadChannels,
    bootstrapDefaultChannels,
    loadMessages,
    send,
  };
}

export default useCommunicationCenter;
