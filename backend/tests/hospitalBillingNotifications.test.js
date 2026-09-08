import {
  buildBillingMilestoneNotifications,
  buildMonthlySummaryNotification,
  dispatchBillingMilestoneNotifications,
} from "../services/hospitalBillingNotifications.js";

describe("Hospital billing notifications", () => {
  it("builds milestone alert payloads for pending thresholds", () => {
    const hospital = {
      _id: "hospital-1",
      name: "Test Hospital",
      billing: {
        monthlyTarget: 1000,
        monthlySpent: 900,
        balanceOutstanding: 250,
        alertThresholds: [50, 70, 80, 90, 100, 110, 125],
        alertedMilestones: [50],
      },
      getBillingState: () => ({
        status: "PAYMENT_DUE",
        budgetProgress: { target: 1000, spent: 900, percentage: 90, remaining: 100 },
        pendingMilestones: [90],
      }),
    };

    const notifications = buildBillingMilestoneNotifications(hospital, new Date("2025-01-16T00:00:00.000Z"));

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain("90%");
    expect(notifications[0].meta.milestone).toBe(90);
  });

  it("builds an end-of-month summary payload with budget and balance details", () => {
    const hospital = {
      _id: "hospital-2",
      name: "Budget Hospital",
      billing: {
        monthlyTarget: 1000,
        monthlySpent: 1100,
        balanceOutstanding: 250,
        status: "PAYMENT_DUE",
      },
      getBillingState: () => ({
        status: "PAYMENT_DUE",
        targetExceeded: true,
        budgetProgress: { target: 1000, spent: 1100, percentage: 110, remaining: 0 },
      }),
    };

    const notification = buildMonthlySummaryNotification(hospital, new Date("2025-01-31T00:00:00.000Z"));

    expect(notification.title).toContain("End-of-month");
    expect(notification.body).toContain("110%");
    expect(notification.body).toContain("Core services remained available");
    expect(notification.body).toContain("outstanding balance");
  });

  it("mentions that core services remain available in milestone alerts", () => {
    const hospital = {
      _id: "hospital-4",
      name: "Core Care Hospital",
      billing: {
        monthlyTarget: 1000,
        monthlySpent: 900,
        balanceOutstanding: 0,
        alertThresholds: [50, 70, 80, 90, 100],
        alertedMilestones: [],
      },
      getBillingState: () => ({
        status: "CURRENT",
        budgetProgress: { target: 1000, spent: 900, percentage: 90, remaining: 100 },
        pendingMilestones: [90],
      }),
    };

    const notifications = buildBillingMilestoneNotifications(hospital, new Date("2025-01-16T00:00:00.000Z"));

    expect(notifications[0].body).toContain("Core hospital operations remain available");
  });

  it("dispatches milestone alerts via an injected notifier", async () => {
    const hospital = {
      _id: "hospital-3",
      name: "Alert Hospital",
      billing: {
        monthlyTarget: 1000,
        monthlySpent: 800,
        balanceOutstanding: 0,
        alertThresholds: [50, 70, 80, 90, 100],
        alertedMilestones: [],
      },
      getBillingState: () => ({
        status: "CURRENT",
        budgetProgress: { target: 1000, spent: 800, percentage: 80, remaining: 200 },
        pendingMilestones: [80],
      }),
    };

    const sent = [];
    await dispatchBillingMilestoneNotifications({
      hospital,
      now: new Date("2025-01-16T00:00:00.000Z"),
      notifier: async (payload) => {
        sent.push(payload);
        return payload;
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].meta.milestone).toBe(80);
  });
});
