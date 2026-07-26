import { describe, expect, it } from "vitest";
import { getAppointmentFlowStage, getVisibleHospitals } from "./appointmentLayoutUtils";

describe("appointmentLayoutUtils", () => {
  it("limits the initial hospital list to the top recommended entries", () => {
    const hospitals = [{ _id: "1" }, { _id: "2" }, { _id: "3" }, { _id: "4" }];
    expect(getVisibleHospitals(hospitals, false, 3).map((item) => item._id)).toEqual(["1", "2", "3"]);
  });

  it("expands the hospital list when requested", () => {
    const hospitals = [{ _id: "1" }, { _id: "2" }, { _id: "3" }, { _id: "4" }];
    expect(getVisibleHospitals(hospitals, true, 3).map((item) => item._id)).toEqual(["1", "2", "3", "4"]);
  });

  it("advances the appointment flow stage as the booking journey progresses", () => {
    expect(getAppointmentFlowStage({ selectedHospital: false })).toBe(1);
    expect(getAppointmentFlowStage({ selectedHospital: true, selectedService: false })).toBe(2);
    expect(getAppointmentFlowStage({ selectedHospital: true, selectedService: true })).toBe(3);
    expect(getAppointmentFlowStage({ selectedHospital: true, selectedService: true, bookingSuccess: true })).toBe(4);
  });
});
