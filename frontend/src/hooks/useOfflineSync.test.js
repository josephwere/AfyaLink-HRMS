import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import localforage from "localforage";
import { useOfflineSync } from "./useOfflineSync";
import * as offlineSyncApi from "../services/offlineOpsApi";

vi.mock("localforage", () => ({
  default: {
    config: vi.fn(),
    keys: vi.fn(),
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("../services/offlineOpsApi", () => ({
  uploadOfflineSyncItems: vi.fn(),
}));

describe("useOfflineSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("syncs queued items through the service layer", async () => {
    localforage.keys.mockResolvedValue(["queued-1"]);
    localforage.getItem.mockResolvedValue({ payload: "test" });
    localforage.removeItem.mockResolvedValueOnce(undefined);
    offlineSyncApi.uploadOfflineSyncItems.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.syncAll();
    });

    expect(offlineSyncApi.uploadOfflineSyncItems).toHaveBeenCalled();
  });
});
