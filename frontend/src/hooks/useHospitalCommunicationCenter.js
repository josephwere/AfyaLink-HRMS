import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import {
  createHospitalBroadcast,
  listHospitalBroadcasts,
  listHospitalCommunicationAnalytics,
  listHospitalCommunicationTemplates,
  listHospitalNotificationLogs,
  sendHospitalBroadcast,
  upsertHospitalCommunicationTemplate,
} from "../services/hospitalCommunicationApi";

const DEFAULT_EVENT_OPTIONS = [
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_REMINDER",
  "APPOINTMENT_COMPLETED",
  "APPOINTMENT_CANCELLED",
  "NEW_SERVICE",
  "HOLIDAY_CLOSURE",
  "BROADCAST",
  "CUSTOM",
];

const DEFAULT_CHANNEL_OPTIONS = ["EMAIL", "SMS", "PUSH", "IN_APP"];
const DEFAULT_AUDIENCE_OPTIONS = [
  "ALL_PATIENTS",
  "ALL_DOCTORS",
  "ALL_NURSES",
  "ALL_PHARMACISTS",
  "ALL_RECEPTIONISTS",
  "ALL_STAFF",
];

export function useHospitalCommunicationCenter() {
  const { user } = useAuth();
  const isHospitalAdmin = user?.role === "HOSPITAL_ADMIN";
  const hospitalId = user?.hospitalId || user?.hospital || "";

  const [templates, setTemplates] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [analytics, setAnalytics] = useState({
    messagesSent: 0,
    emailsDelivered: 0,
    smsDelivered: 0,
    pushDelivered: 0,
    readRate: 0,
    openRate: 0,
    clickRate: 0,
    failedDeliveries: 0,
    queuedMessages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [eventType, setEventType] = useState("APPOINTMENT_CONFIRMED");
  const [channel, setChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Dear {{patientName}},\n\nYour appointment has been successfully booked.");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastAudience, setBroadcastAudience] = useState(["ALL_PATIENTS"]);
  const [broadcastChannels, setBroadcastChannels] = useState(["IN_APP"]);
  const [scheduledAt, setScheduledAt] = useState("");

  const eventOptions = useMemo(() => DEFAULT_EVENT_OPTIONS, []);
  const channelOptions = useMemo(() => DEFAULT_CHANNEL_OPTIONS, []);
  const audienceOptions = useMemo(() => DEFAULT_AUDIENCE_OPTIONS, []);

  const loadData = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [templatesRes, broadcastsRes, analyticsRes, logsRes] = await Promise.all([
        listHospitalCommunicationTemplates(),
        listHospitalBroadcasts(),
        listHospitalCommunicationAnalytics(),
        listHospitalNotificationLogs(),
      ]);
      setTemplates(Array.isArray(templatesRes?.items) ? templatesRes.items : []);
      setBroadcasts(Array.isArray(broadcastsRes?.items) ? broadcastsRes.items : []);
      setAnalytics(analyticsRes?.item || {
        messagesSent: 0,
        emailsDelivered: 0,
        smsDelivered: 0,
        pushDelivered: 0,
        readRate: 0,
        openRate: 0,
        clickRate: 0,
        failedDeliveries: 0,
        queuedMessages: 0,
      });
      setLogs(Array.isArray(logsRes?.items) ? logsRes.items : []);
    } catch (err) {
      setMessage(err?.message || "Unable to load communication center data");
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveTemplate = useCallback(async () => {
    if (!hospitalId || !eventType || !channel || !body.trim()) {
      setMessage("Select an event, channel, and enter a template body.");
      return;
    }

    try {
      await upsertHospitalCommunicationTemplate({
        hospitalId,
        eventType,
        channel,
        subject,
        body,
        isDefault: false,
        isActive: true,
      });
      await loadData();
      setMessage("Hospital communication template saved.");
    } catch (err) {
      setMessage(err?.message || "Unable to save template");
    }
  }, [body, channel, eventType, hospitalId, loadData, subject]);

  const createBroadcast = useCallback(async () => {
    if (!hospitalId || !broadcastTitle.trim() || !broadcastMessage.trim()) {
      setMessage("Enter a broadcast title and message.");
      return;
    }

    try {
      await createHospitalBroadcast({
        hospitalId,
        title: broadcastTitle,
        message: broadcastMessage,
        audience: broadcastAudience,
        channels: broadcastChannels,
        scheduledAt: scheduledAt || null,
      });
      setBroadcastTitle("");
      setBroadcastMessage("");
      setScheduledAt("");
      await loadData();
      setMessage("Broadcast created.");
    } catch (err) {
      setMessage(err?.message || "Unable to create broadcast");
    }
  }, [broadcastAudience, broadcastChannels, broadcastMessage, broadcastTitle, hospitalId, loadData, scheduledAt]);

  const sendBroadcast = useCallback(async (broadcastId) => {
    try {
      await sendHospitalBroadcast(broadcastId);
      await loadData();
      setMessage("Broadcast sent to the selected audience.");
    } catch (err) {
      setMessage(err?.message || "Unable to send broadcast");
    }
  }, [loadData]);

  const toggleAudience = useCallback((value) => {
    setBroadcastAudience((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }, []);

  const toggleChannel = useCallback((value) => {
    setBroadcastChannels((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }, []);

  return {
    isHospitalAdmin,
    hospitalId,
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
    loadData,
    setMessage,
  };
}

export default useHospitalCommunicationCenter;
