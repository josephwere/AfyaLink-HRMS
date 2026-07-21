import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSupportTickets } from "./useSupportTickets";
import * as opsApi from "../services/opsApi";

vi.mock("../services/opsApi", () => ({
  createSupportTicket: vi.fn(),
  exportSupportTicketsCsv: vi.fn(),
  listSupportTickets: vi.fn(),
  updateSupportTicket: vi.fn(),
}));

describe("useSupportTickets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads tickets and creates them through the service layer", async () => {
    opsApi.listSupportTickets.mockResolvedValueOnce({ tickets: [{ _id: "1", status: "OPEN" }] });
    opsApi.createSupportTicket.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useSupportTickets({ searchParams: new URLSearchParams(), user: { actualRole: "SYSTEM_ADMIN" } }));

    await act(async () => {
      await result.current.load();
    });

    expect(opsApi.listSupportTickets).toHaveBeenCalled();
    expect(result.current.tickets).toHaveLength(1);

    act(() => {
      result.current.setForm((prev) => ({ ...prev, title: "Need help" }));
    });

    await act(async () => {
      await result.current.submit({ preventDefault: () => {} });
    });

    expect(opsApi.createSupportTicket).toHaveBeenCalled();
  });
});
