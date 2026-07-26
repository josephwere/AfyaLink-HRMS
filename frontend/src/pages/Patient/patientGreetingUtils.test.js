import { describe, expect, it } from "vitest";
import { getPersonalizedGreeting } from "./patientGreetingUtils";

describe("getPersonalizedGreeting", () => {
  it("uses the authenticated patient's name for the greeting", () => {
    expect(getPersonalizedGreeting({ name: "Barasa" }, new Date("2026-07-23T20:00:00"))).toBe("Good Evening, Barasa");
  });

  it("adds a doctor prefix for doctor accounts", () => {
    expect(getPersonalizedGreeting({ name: "Amina", role: "DOCTOR" }, new Date("2026-07-23T08:00:00"))).toBe("Good Morning, Dr. Amina");
  });

  it("falls back to a neutral label when no profile name is available", () => {
    expect(getPersonalizedGreeting({}, new Date("2026-07-23T12:00:00"))).toBe("Good Afternoon, there");
  });
});
