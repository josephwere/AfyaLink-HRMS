import Hospital from "../models/Hospital.js";

describe("Hospital billing policy", () => {
  it("derives premium restriction and milestone alerts from spending and balance", () => {
    const hospital = new Hospital({
      name: "Test Hospital",
      billing: {
        monthlyTarget: 1000,
        monthlySpent: 900,
        balanceOutstanding: 250,
        paymentDueAt: new Date("2025-01-15T00:00:00.000Z"),
        alertThresholds: [50, 70, 80, 90, 100, 110, 125],
        alertedMilestones: [],
      },
    });

    const state = hospital.getBillingState(new Date("2025-01-16T00:00:00.000Z"));

    expect(state.status).toBe("PAYMENT_DUE");
    expect(state.budgetProgress.percentage).toBe(90);
    expect(state.milestonesTriggered).toContain(90);
    expect(state.restrictPremiumFeatures).toBe(true);
  });

  it("flags over-target spend as a budget breach", () => {
    const hospital = new Hospital({
      name: "Budget Breach Hospital",
      billing: {
        monthlyTarget: 1000,
        monthlySpent: 1100,
        balanceOutstanding: 0,
        alertThresholds: [50, 70, 80, 90, 100, 110, 125],
        alertedMilestones: [],
      },
    });

    const state = hospital.getBillingState(new Date("2025-01-16T00:00:00.000Z"));

    expect(state.status).toBe("CURRENT");
    expect(state.targetExceeded).toBe(true);
    expect(state.budgetProgress.percentage).toBe(110);
    expect(state.milestonesTriggered).toContain(100);
    expect(state.restrictPremiumFeatures).toBe(true);
  });
});
