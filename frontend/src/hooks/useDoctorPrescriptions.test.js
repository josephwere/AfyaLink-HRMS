import { describe, expect, it } from "vitest";
import { filterPrescriptionAppointments } from "./useDoctorPrescriptions";

describe("filterPrescriptionAppointments", () => {
  it("keeps only active appointments that are still actionable for prescription workflows", () => {
    const now = new Date("2025-01-15T12:00:00Z");

    const appointments = [
      { _id: "1", status: "Scheduled", scheduledAt: "2025-01-15T12:30:00Z" },
      { _id: "2", status: "Completed", scheduledAt: "2025-01-15T11:00:00Z" },
      { _id: "3", status: "Cancelled", scheduledAt: "2025-01-15T13:00:00Z" },
      { _id: "4", status: "No Show", scheduledAt: "2025-01-15T10:00:00Z" },
      { _id: "5", status: "Scheduled", scheduledAt: "2025-01-14T11:00:00Z" },
      { _id: "6", status: "Scheduled", scheduledAt: "2025-01-15T15:00:00Z" },
    ];

    const filtered = filterPrescriptionAppointments(appointments, now);

    expect(filtered.map((item) => item._id)).toEqual(["1", "6"]);
  });
});
