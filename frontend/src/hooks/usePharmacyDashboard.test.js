import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react-hooks";
import { usePharmacyDashboard } from "./usePharmacyDashboard";
import pharmacyService from "../services/pharmacy";

vi.mock("../services/pharmacy", () => ({
  default: {
    listItems: vi.fn(),
    listPrescriptions: vi.fn(),
    listFacilityTransfers: vi.fn(),
  },
}));

describe("usePharmacyDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads pharmacy dashboard data through the shared service layer", async () => {
    pharmacyService.listItems.mockResolvedValue({ items: [{ _id: "1", qty: 1, minStock: 2 }] });
    pharmacyService.listPrescriptions.mockResolvedValue({ items: [{ _id: "p1", status: "CREATED" }] });
    pharmacyService.listFacilityTransfers.mockResolvedValue({ items: [{ _id: "t1", status: "PENDING" }] });

    const { result, waitForNextUpdate } = renderHook(() => usePharmacyDashboard({ limit: 25 }));
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([{ _id: "1", qty: 1, minStock: 2 }]);
    expect(result.current.prescriptions).toEqual([{ _id: "p1", status: "CREATED" }]);
    expect(result.current.transfers).toEqual([{ _id: "t1", status: "PENDING" }]);
    expect(result.current.error).toBe("");
  });
});
