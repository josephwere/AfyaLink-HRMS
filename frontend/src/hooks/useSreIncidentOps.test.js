import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSreIncidentOps } from "./useSreIncidentOps";
import * as opsApi from "../services/opsApi";

vi.mock("../services/opsApi", () => ({
  ackSreIncident: vi.fn(),
  createSreIncident: vi.fn(),
  exportSreIncidentsCsv: vi.fn(),
  escalateSreIncident: vi.fn(),
  listSreIncidents: vi.fn(),
  mitigateSreIncident: vi.fn(),
  resolveSreIncident: vi.fn(),
}));

describe("useSreIncidentOps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads incidents and submits them through the service layer", async () => {
    opsApi.listSreIncidents.mockResolvedValueOnce({ incidents: [{ _id: "1" }] });
    opsApi.createSreIncident.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useSreIncidentOps());

    await act(async () => {
      await result.current.load();
    });

    expect(opsApi.listSreIncidents).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);

    act(() => {
      result.current.setForm((prev) => ({ ...prev, summary: "Database latency" }));
    });

    await act(async () => {
      await result.current.submit({ preventDefault: () => {} });
    });

    expect(opsApi.createSreIncident).toHaveBeenCalled();
  });
});
