import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import FinanceExecutiveDashboard from "./ExecutiveDashboard";

const getExecutiveDashboardMock = vi.fn();

vi.mock("../../services/dashboardApi", () => ({
  getExecutiveDashboard: () => getExecutiveDashboardMock(),
}));

describe("Finance executive dashboard", () => {
  beforeEach(() => {
    getExecutiveDashboardMock.mockReset();
  });

  it("renders the verified executive dashboard contract for CFO users", async () => {
    getExecutiveDashboardMock.mockResolvedValue({
      totalStaff: 128,
      revenueToday: 125000,
      bedOccupancyRate: 82,
      pendingClaims: 9,
      pharmacyCoverageRisk: true,
      laboratoryQueue: 4,
      radiologyQueue: 2,
      auditAlerts: 3,
      domains: {
        operations: {
          totalBeds: 160,
          occupiedBeds: 131,
          availableBeds: 29,
          pendingAdmissions: 6,
        },
        pharmacy: {
          alerts: 2,
          pendingPrescriptions: 8,
        },
        finance: {
          revenueToday: 125000,
          outstandingAmount: 45000,
          collectedAmount: 89000,
          totalClaims: 24,
          approvalRate: 92,
          denialRate: 8,
          reviewRequiredCount: 3,
          actions: [{ severity: "HIGH", title: "Collection follow-up", detail: "Three invoices are overdue." }],
        },
        clinical: {
          pendingLabOrders: 5,
          pendingImagingStudies: 1,
          criticalFindingsBacklog: 0,
        },
      },
    });

    render(<FinanceExecutiveDashboard />);

    await waitFor(() => expect(screen.getByText("Executive overview")).toBeInTheDocument());
    expect(screen.getByText("Revenue today")).toBeInTheDocument();
    expect(screen.getByText("Outstanding receivables")).toBeInTheDocument();
    expect(screen.getByText("Pending claims")).toBeInTheDocument();
    expect(screen.getByText("Care operations")).toBeInTheDocument();
    expect(screen.getByText("Finance pulse")).toBeInTheDocument();
    expect(screen.getByText("Pharmacy and clinical risk")).toBeInTheDocument();
  });
});
