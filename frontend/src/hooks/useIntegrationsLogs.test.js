import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntegrationsLogs } from "./useIntegrationsLogs";
import * as auditApi from "../services/auditApi";

vi.mock("../services/auditApi", () => ({
  fetchAuditLogs: vi.fn(),
}));

describe("useIntegrationsLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads integration audit logs through the service layer", async () => {
    auditApi.fetchAuditLogs.mockResolvedValueOnce({ data: [{ _id: "1", action: "sync" }] });

    const { result } = renderHook(() => useIntegrationsLogs());

    await act(async () => {
      await result.current.load();
    });

    expect(auditApi.fetchAuditLogs).toHaveBeenCalled();
    expect(result.current.logs[0].action).toBe("sync");
  });
});
