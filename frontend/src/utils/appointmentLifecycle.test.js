import { describe, expect, it } from "vitest";
import {
  canStartRemoteConsultation,
  getAppointmentLifecycleState,
  getLifecycleTransitionHint,
} from "./appointmentLifecycle";

describe("appointment lifecycle UI helpers", () => {
  it("maps workflow-backed statuses to doctor-facing labels", () => {
    expect(getAppointmentLifecycleState({ status: "Scheduled" }).label).toBe("Scheduled");
    expect(getAppointmentLifecycleState({ status: "CheckedIn" }).label).toBe("Checked in");
    expect(getAppointmentLifecycleState({ status: "InConsultation" }).label).toBe("In consultation");
    expect(getAppointmentLifecycleState({ status: "Completed" }).label).toBe("Completed");
    expect(getAppointmentLifecycleState({ status: "Cancelled" }).label).toBe("Cancelled");
  });

  it("only allows remote consultation starts after the patient is provider ready", () => {
    expect(canStartRemoteConsultation({ status: "Scheduled", consultationMode: "VIDEO" })).toBe(false);
    expect(canStartRemoteConsultation({ status: "CheckedIn", consultationMode: "VIDEO" })).toBe(false);
    expect(canStartRemoteConsultation({ status: "ProviderReady", consultationMode: "VIDEO" })).toBe(true);
    expect(canStartRemoteConsultation({ status: "InConsultation", consultationMode: "VOICE" })).toBe(true);
    expect(canStartRemoteConsultation({ status: "Completed", consultationMode: "VIDEO" })).toBe(false);
  });

  it("provides actionable guidance for the next lifecycle step", () => {
    expect(getLifecycleTransitionHint({ status: "Scheduled" }).action).toBe("Check in patient");
    expect(getLifecycleTransitionHint({ status: "CheckedIn" }).action).toBe("Mark provider ready");
    expect(getLifecycleTransitionHint({ status: "Completed" }).action).toBe("Completed");
  });
});
