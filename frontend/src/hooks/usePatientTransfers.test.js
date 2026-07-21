import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientTransfers } from "./usePatientTransfers";
import * as transferApi from "../services/transferApi";

vi.mock("../services/transferApi", () => ({
  listMyTransfers: vi.fn(),
  patientGrantTransferConsent: vi.fn(),
  patientRevokeTransferConsent: vi.fn(),
}));

describe("usePatientTransfers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transferApi.listMyTransfers.mockResolvedValue({ items: [{ _id: "t-1", status: "Pending", consent: { scopes: ["demographics"], expiresAt: null } }] });
    transferApi.patientGrantTransferConsent.mockResolvedValue({ ok: true });
    transferApi.patientRevokeTransferConsent.mockResolvedValue({ ok: true });
  });

  it("loads transfers and supports consent actions through the shared hook", async () => {
    const { result } = renderHook(() => usePatientTransfers());

    await act(async () => {
      await result.current.load();
      await result.current.grantConsent();
      await result.current.revokeConsent();
    });

    expect(transferApi.listMyTransfers).toHaveBeenCalled();
    expect(transferApi.patientGrantTransferConsent).toHaveBeenCalled();
    expect(transferApi.patientRevokeTransferConsent).toHaveBeenCalled();
    expect(result.current.rows).toHaveLength(1);
  });
});
