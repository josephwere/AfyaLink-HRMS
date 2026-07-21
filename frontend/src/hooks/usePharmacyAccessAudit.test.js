import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePharmacyAccessAudit } from "./usePharmacyAccessAudit";
import apiFetch from "../utils/apiFetch";
import { listRegisteredPharmacies } from "../services/pharmacyNetworkApi";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../utils/apiFetch", () => ({ default: vi.fn() }));
vi.mock("../services/pharmacyNetworkApi", () => ({
  listRegisteredPharmacies: vi.fn(),
}));

describe("usePharmacyAccessAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads pharmacy access audit data", async () => {
    apiFetch
      .mockResolvedValueOnce({ items: [{ _id: "u1", name: "A", registeredPharmacy: null }] })
      .mockResolvedValueOnce({ items: [{ _id: "u1", name: "A" }] })
      .mockResolvedValueOnce({ items: [{ _id: "p1", name: "Pharmacy" }] })
      .mockResolvedValueOnce({ summary: { matched: 1, ambiguous: 0, skipped: 0 }, matched: [], ambiguous: [], skipped: [] });
    listRegisteredPharmacies.mockResolvedValueOnce({ items: [{ _id: "p1", name: "Pharmacy" }] });

    const { result } = renderHook(() => usePharmacyAccessAudit());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.summary.total).toBe(1);
    expect(result.current.summary.unlinked).toBe(1);
    expect(result.current.pharmacyNameById.p1).toBe("Pharmacy");
  });
});
