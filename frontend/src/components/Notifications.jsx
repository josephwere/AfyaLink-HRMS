import React, { useEffect, useState } from "react";
import { useSocket } from "../utils/socket";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationsApi";

export default function Notifications(){
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("ALL");
  const [read, setRead] = useState("ALL");
  const socket = useSocket();
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "ALL") params.set("category", category);
    if (read === "READ") params.set("read", "true");
    if (read === "UNREAD") params.set("read", "false");
    const query = params.toString();
    const fetcher = query
      ? listNotifications({ query })
      : listNotifications();
    fetcher
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else if (Array.isArray(data?.items)) setItems(data.items);
        else setItems([]);
      })
      .catch(() => {});
  }, [category, read]);
  useEffect(()=>{
    if (!socket) return;
    const pushLocal = (item) => setItems((prev) => [{ ...item, read: false, createdAt: new Date().toISOString() }, ...prev]);
    const invoiceCreated = (data)=> pushLocal({title:'Invoice', body:'New invoice created', category: 'BILLING', meta:data});
    const paymentRecorded = (data)=> pushLocal({title:'Payment', body:'Payment recorded', category: 'BILLING', meta:data});
    const labResult = (data)=> pushLocal({title:'Lab results available', body:'New lab results are ready for review.', category: 'LAB', meta:data});
    const consultationRequested = (data)=> pushLocal({title:'Incoming consultation request', body:'A patient requested an online consultation.', category: 'CONSULTATION', meta:data});
    const consultationAccepted = (data)=> pushLocal({title:'Doctor accepted consultation', body:'Your doctor is ready. Join your secure consultation room.', category: 'CONSULTATION', meta:data});
    const consultationDeclined = (data)=> pushLocal({title:'Consultation request declined', body:'The doctor could not join this consultation.', category: 'CONSULTATION', meta:data});
    const consultationCompleted = (data)=> pushLocal({title:'Consultation completed', body:'Summary, prescription, or follow-up details will appear when available.', category: 'CONSULTATION', meta:data});
    const appointmentCreated = (data)=> pushLocal({title:'Appointment confirmed', body:'Your appointment has been booked and added to your schedule.', category: 'APPOINTMENT', meta:data});
    const appointmentUpdated = (data)=> {
      const followUpRequired = Boolean(data?.metadata?.followUpRequired);
      pushLocal({
        title: followUpRequired ? 'Follow-up scheduled' : 'Appointment updated',
        body: followUpRequired ? 'Your doctor recommended a follow-up appointment.' : 'Your appointment details were updated.',
        category: 'APPOINTMENT',
        meta:data,
      });
    };
    const prescriptionIssued = (data)=> pushLocal({title:'Prescription issued', body:'Medication details are ready in your prescriptions.', category: 'PHARMACY', meta:data});
    socket.on('invoiceCreated', invoiceCreated);
    socket.on('paymentRecorded', paymentRecorded);
    socket.on('labResult', labResult);
    socket.on('consultation_requested', consultationRequested);
    socket.on('consultation_accepted', consultationAccepted);
    socket.on('consultation_declined', consultationDeclined);
    socket.on('consultation_completed', consultationCompleted);
    socket.on('appointmentCreated', appointmentCreated);
    socket.on('appointmentUpdated', appointmentUpdated);
    socket.on('prescription_issued', prescriptionIssued);
    return ()=>{
      socket.off('invoiceCreated', invoiceCreated);
      socket.off('paymentRecorded', paymentRecorded);
      socket.off('labResult', labResult);
      socket.off('consultation_requested', consultationRequested);
      socket.off('consultation_accepted', consultationAccepted);
      socket.off('consultation_declined', consultationDeclined);
      socket.off('consultation_completed', consultationCompleted);
      socket.off('appointmentCreated', appointmentCreated);
      socket.off('appointmentUpdated', appointmentUpdated);
      socket.off('prescription_issued', prescriptionIssued);
    }
  },[socket]);
  return (
    <div className="card">
      <div className="welcome-panel" style={{ marginBottom: 12 }}>
        <div>
          <h4>Notifications</h4>
          <p className="muted">Recent activity and requests.</p>
        </div>
        <div className="welcome-actions">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ALL">All Categories</option>
            <option value="WORKFORCE">Workforce</option>
            <option value="SECURITY">Security</option>
            <option value="BILLING">Billing</option>
            <option value="SYSTEM">System</option>
            <option value="INTEGRATION">Integration</option>
            <option value="AI">AI</option>
            <option value="PHARMACY">Pharmacy</option>
            <option value="CONSULTATION">Consultation</option>
            <option value="APPOINTMENT">Appointment</option>
            <option value="LAB">Lab</option>
          </select>
          <select value={read} onChange={(e) => setRead(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await markAllNotificationsRead();
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
              } catch {
                // Keep existing state on failure.
              }
            }}
          >
            Mark all read
          </button>
        </div>
      </div>
      <ul>
        {items.map((n,idx)=> (
          <li key={idx}>
            <button
              type="button"
              className="action-link"
              style={{ background: n.read ? "#6b7280" : "#111827" }}
              onClick={async () => {
                try {
                  if (n._id && !n.read) {
                    await markNotificationRead(n._id);
                  }
                  setItems((prev) =>
                    prev.map((item) =>
                      item._id === n._id ? { ...item, read: true } : item
                    )
                  );
                } catch {
                  // No-op when mark read fails.
                }
              }}
            >
              <strong>{n.title}</strong> - {n.body || (n.meta && n.meta.test)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
