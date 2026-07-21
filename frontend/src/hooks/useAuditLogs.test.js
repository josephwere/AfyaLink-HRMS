import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuditLogs } from "./useAuditLogs";
import * as auditApi from "../services/auditApi";

vi.mock("../services/auditApi", () => ({
  fetchAuditLogs: vi.fn(),
  fetchEvidenceBundle: vi.fn(),
}));

describe("useAuditLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads audit logs through the service layer", async () => {
    auditApi.fetchAuditLogs.mockResolvedValueOnce([{ _id: "1", action: "LOGIN" }]);

    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      await result.current.load();
    });

    expect(auditApi.fetchAuditLogs).toHaveBeenCalled();
    expect(result.current.logs[0].action).toBe("LOGIN");
  });
});
