import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function MyAppointments() {
  return (
    <ModuleWorkspace
      title="My Appointments"
      subtitle="Upcoming, completed and rescheduled appointment history."
      actions={[{ label: "Book Appointment", variant: "primary" }, { label: "Reschedule" }]}
      panels={[
        { title: "Upcoming", body: "Upcoming appointments and reminders." },
        { title: "History", body: "Completed visit history timeline." },
        { title: "Follow-up", body: "Required follow-up and action items." },
      ]}
    />
  );
}
