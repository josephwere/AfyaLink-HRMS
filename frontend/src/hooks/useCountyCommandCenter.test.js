import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCountyCommandCenter } from "./useCountyCommandCenter";
import * as systemAdminApi from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  getCountyCommandCenterSummary: vi.fn(),
}));

describe("useCountyCommandCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads county summary data on mount", async () => {
    vi.mocked(systemAdminApi.getCountyCommandCenterSummary).mockResolvedValue({ payload: { summary: { totalRegions: 2 }, regions: [] } });

    const { result } = renderHook(() => useCountyCommandCenter());

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.regions).toEqual([]);
  });
});
