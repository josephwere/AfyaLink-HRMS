import { beforeEach, describe, expect, it, vi } from "vitest";

const guardedConsoleFetchMock = vi.hoisted(() => vi.fn());

vi.mock("./guardedConsoleFetch", () => ({
  guardedConsoleFetch: guardedConsoleFetchMock,
}));

import { clearCapabilitiesCache, getUserCapabilities } from "./capabilityApi";

describe("capabilityApi", () => {
  beforeEach(() => {
    guardedConsoleFetchMock.mockReset();
    clearCapabilitiesCache();
  });

  it("dedupes concurrent capability requests", async () => {
    guardedConsoleFetchMock.mockResolvedValue({
      payload: {
        success: true,
        capabilities: ["care.view"],
        capabilitiesWithMetadata: [{ id: "care.view", title: "Care" }],
      },
    });

    const [first, second] = await Promise.all([getUserCapabilities(), getUserCapabilities()]);

    expect(guardedConsoleFetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first?.capabilities).toEqual(["care.view"]);
  });
});
