import { describe, expect, it } from "vitest";
import { buildJourneySteps } from "./patientJourneyUtils";

describe("patientJourneyUtils", () => {
  it("builds a complete journey with state markers", () => {
    const steps = buildJourneySteps({
      bookingSuccess: true,
      doctorAssigned: true,
      travelComplete: false,
    });

    expect(steps.map((step) => step.key)).toEqual([
      "discover",
      "booked",
      "assigned",
      "travel",
      "checkin",
      "consultation",
      "laboratory",
      "pharmacy",
      "billing",
      "followup",
    ]);
    expect(steps[0].status).toBe("done");
    expect(steps[2].status).toBe("done");
    expect(steps[3].status).toBe("pending");
  });
});
