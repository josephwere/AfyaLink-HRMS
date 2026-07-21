import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
import { useLabOps } from "./useLabOps";
import { listLabOpsRecords, createLabOpsRecord } from "../services/labOpsApi";

vi.mock("../services/labOpsApi", () => ({
  listLabOpsRecords: vi.fn(),
  createLabOpsRecord: vi.fn(),
}));

describe("useLabOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads records and creates new records through the shared service", async () => {
    listLabOpsRecords.mockResolvedValueOnce({ items: [{ _id: "1", title: "Demo" }], total: 1 });
    createLabOpsRecord.mockResolvedValueOnce({ ok: true });

    const { result, waitForNextUpdate } = renderHook(() => useLabOps({ kind: "QUALITY_CONTROL", limit: 20 }));
    await waitForNextUpdate();

    expect(result.current.records).toHaveLength(1);
    expect(result.current.total).toBe(1);

    await act(async () => {
      await result.current.createRecord({ kind: "QUALITY_CONTROL", title: "New" });
    });

    expect(createLabOpsRecord).toHaveBeenCalled();
    expect(result.current.message).toContain("saved");
  });
});
