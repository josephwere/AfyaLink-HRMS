import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { usePharmacyQueue } from "./usePharmacyQueue";
import pharmacyService from "../services/pharmacy";
import { listPharmacyReferrals, updatePharmacyReferral } from "../services/pharmacyNetworkApi";
import { listTransfers } from "../services/transferApi";

vi.mock("../services/pharmacy", () => ({
  default: {
    listPrescriptions: vi.fn(),
    dispenseStock: vi.fn(),
  },
}));
vi.mock("../services/pharmacyNetworkApi", () => ({
  listPharmacyReferrals: vi.fn(),
  updatePharmacyReferral: vi.fn(),
}));
vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("usePharmacyQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads queue items and transfer summaries", async () => {
    pharmacyService.listPrescriptions.mockResolvedValue({ items: [{ _id: "1", status: "CREATED" }] });
    listPharmacyReferrals.mockResolvedValue({ items: [{ _id: "2", status: "PENDING" }] });
    listTransfers.mockResolvedValue({ items: [{ _id: "3", status: "Pending" }] });

    const { result, waitForNextUpdate } = renderHook(() => usePharmacyQueue());
    await waitForNextUpdate();

    expect(result.current.items).toHaveLength(1);
    expect(result.current.referrals).toHaveLength(1);
    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.visible).toHaveLength(1);
  });

  it("dispenses a prescription through the pharmacy service", async () => {
    pharmacyService.listPrescriptions.mockResolvedValue({ items: [{ _id: "1", status: "CREATED" }] });
    listPharmacyReferrals.mockResolvedValue({ items: [] });
    listTransfers.mockResolvedValue({ items: [] });
    pharmacyService.dispenseStock.mockResolvedValue({ ok: true });

    const { result, waitForNextUpdate } = renderHook(() => usePharmacyQueue());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.dispense({ _id: "1", encounter: "enc-1" });
    });

    expect(pharmacyService.dispenseStock).toHaveBeenCalled();
    expect(result.current.msg).toContain("dispensed");
  });
});
