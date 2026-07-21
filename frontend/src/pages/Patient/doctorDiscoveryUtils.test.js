import { describe, expect, it } from "vitest";
import { filterDoctorsForDiscovery, getDoctorRecommendation } from "./doctorDiscoveryUtils";

describe("doctorDiscoveryUtils", () => {
  it("filters doctors by the selected discovery criteria", () => {
    const doctors = [
      { _id: "1", name: "Dr Amina", specialization: "Cardiology", languages: ["English", "Swahili"], gender: "Female", consultationMode: ["VIDEO"], insuranceAccepted: true, availableToday: true, consultationFee: 2500, yearsOfExperience: 12 },
      { _id: "2", name: "Dr Joseph", specialization: "Neurology", languages: ["English"], gender: "Male", consultationMode: ["VOICE"], insuranceAccepted: false, availableToday: false, consultationFee: 3500, yearsOfExperience: 8 },
    ];

    const result = filterDoctorsForDiscovery(doctors, {
      specialty: "Cardiology",
      language: "Swahili",
      gender: "Female",
      availability: "available",
      consultationMode: "VIDEO",
      insurance: "accepted",
    });

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("1");
  });

  it("builds recommendation details for a doctor card", () => {
    const doctor = {
      _id: "1",
      name: "Dr Amina",
      availableToday: true,
      consultationMode: ["VIDEO"],
      insuranceAccepted: true,
      consultationFee: 2500,
      yearsOfExperience: 12,
    };

    const recommendation = getDoctorRecommendation(doctor, 0);
    expect(recommendation.score).toBeGreaterThan(80);
    expect(recommendation.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/Best match/i)]));
  });
});
