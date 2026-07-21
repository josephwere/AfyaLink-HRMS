import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectorAnalytics } from "./useConnectorAnalytics";
import * as connectorsApi from "../services/connectorsApi";

vi.mock("../services/connectorsApi", () => ({
  listConnectorAnalytics: vi.fn(),
}));

describe("useConnectorAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads connector analytics through the service layer", async () => {
    connectorsApi.listConnectorAnalytics.mockResolvedValueOnce([{ name: "HL7", lastSync: 1 }]);

    const { result } = renderHook(() => useConnectorAnalytics());

    await act(async () => {
      await result.current.load();
    });

    expect(connectorsApi.listConnectorAnalytics).toHaveBeenCalled();
    expect(result.current.data[0].name).toBe("HL7");
  });
});
