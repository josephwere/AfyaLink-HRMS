import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminIntegrations } from "./useAdminIntegrations";
import * as connectorsApi from "../services/connectorsApi";

vi.mock("../services/connectorsApi", () => ({
  listConnectors: vi.fn(),
  saveConnector: vi.fn(),
  testConnector: vi.fn(),
  testConnectorFhir: vi.fn(),
}));

describe("useAdminIntegrations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and saves connectors through the service layer", async () => {
    connectorsApi.listConnectors.mockResolvedValueOnce([{ _id: "c1", name: "HL7" }]);
    connectorsApi.saveConnector.mockResolvedValueOnce({ _id: "c1" });

    const { result } = renderHook(() => useAdminIntegrations());

    await act(async () => {
      await result.current.load();
    });

    expect(connectorsApi.listConnectors).toHaveBeenCalled();
    expect(result.current.list[0].name).toBe("HL7");

    await act(async () => {
      await result.current.save();
    });

    expect(connectorsApi.saveConnector).toHaveBeenCalled();
  });
});
