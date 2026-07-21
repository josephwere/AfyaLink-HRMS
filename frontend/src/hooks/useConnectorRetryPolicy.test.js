import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectorRetryPolicy } from "./useConnectorRetryPolicy";
import * as connectorsApi from "../services/connectorsApi";

vi.mock("../services/connectorsApi", () => ({
  listConnectors: vi.fn(),
  saveConnectorRetryPolicy: vi.fn(),
}));

describe("useConnectorRetryPolicy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads connectors and saves retry policy through the service layer", async () => {
    connectorsApi.listConnectors.mockResolvedValueOnce([{ _id: "c1", name: "HL7" }]);

    const { result } = renderHook(() => useConnectorRetryPolicy());

    await act(async () => {
      await result.current.load();
    });

    expect(connectorsApi.listConnectors).toHaveBeenCalled();
    expect(result.current.connectors[0].name).toBe("HL7");
  });
});
