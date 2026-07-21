import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectorSdk } from "./useConnectorSdk";
import {
  getConnectorRuntime,
  getConnectorSdkManifest,
  listConnectorSdkTargets,
  updateConnectorRuntime,
} from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  getConnectorRuntime: vi.fn(),
  getConnectorSdkManifest: vi.fn(),
  listConnectorSdkTargets: vi.fn(),
  updateConnectorRuntime: vi.fn(),
}));

describe("useConnectorSdk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the manifest and selects the first connector", async () => {
    getConnectorSdkManifest.mockResolvedValueOnce({ sdkVersion: "1.0.0" });
    listConnectorSdkTargets.mockResolvedValueOnce([{ _id: "conn-1", name: "Lab", type: "FHIR" }]);
    getConnectorRuntime.mockResolvedValueOnce({ runtime: { mode: "SHADOW", dryRun: true } });

    const { result } = renderHook(() => useConnectorSdk());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.manifest.sdkVersion).toBe("1.0.0");
    expect(result.current.connectors).toHaveLength(1);
    expect(result.current.selectedConnectorId).toBe("conn-1");
  });
});
