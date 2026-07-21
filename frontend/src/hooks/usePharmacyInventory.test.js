import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react-hooks";
import { usePharmacyInventory } from "./usePharmacyInventory";
import pharmacyService from "../services/pharmacy";
import { listTransfers } from "../services/transferApi";

vi.mock("../services/pharmacy", () => ({
  default: {
    listAvailableMedicines: vi.fn(),
  },
}));

vi.mock("../services/transferApi", () => ({
  listTransfers: vi.fn(),
}));

describe("usePharmacyInventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads medicines and transfers through the shared service layer", async () => {
    pharmacyService.listAvailableMedicines.mockResolvedValue({ items: [{ _id: "1", name: "Amoxicillin" }] });
    listTransfers.mockResolvedValue({ items: [{ _id: "2", status: "Pending" }] });

    const { result, waitForNextUpdate } = renderHook(() => usePharmacyInventory());
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.medicines).toEqual([{ _id: "1", name: "Amoxicillin" }]);
    expect(result.current.transfers).toEqual([{ _id: "2", status: "Pending" }]);
    expect(result.current.medicineError).toBe("");
    expect(result.current.transferError).toBe("");
  });
});
