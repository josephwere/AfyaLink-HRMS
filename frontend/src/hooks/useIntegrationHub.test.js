import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntegrationHub } from "./useIntegrationHub";
import { getIntegrationHubSummary } from "../services/systemAdminApi";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../services/systemAdminApi", () => ({
  getIntegrationHubSummary: vi.fn(),
}));

describe("useIntegrationHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads integration hub payload and metadata", async () => {
    getIntegrationHubSummary.mockResolvedValueOnce({
      payload: { modules: [{ key: "billing" }], connectors: [{ _id: "conn-1" }], freeApis: [] },
      clientMeta: { attempts: 2, loadedAt: "2024-01-01T00:00:00.000Z" },
    });

    const { result } = renderHook(() => useIntegrationHub());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getIntegrationHubSummary).toHaveBeenCalled();
    expect(result.current.data?.modules).toHaveLength(1);
    expect(result.current.clientMeta?.attempts).toBe(2);
  });
});
