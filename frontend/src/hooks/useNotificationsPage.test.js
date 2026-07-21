import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationsPage } from "./useNotificationsPage";
import * as notificationsApi from "../services/notificationsApi";

vi.mock("../services/notificationsApi", () => ({
  listNotificationsFiltered: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationUnread: vi.fn(),
}));

describe("useNotificationsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads notifications and supports mark-all-read", async () => {
    notificationsApi.listNotificationsFiltered.mockResolvedValueOnce({ items: [{ _id: "1", read: false }] });
    notificationsApi.markAllNotificationsRead.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useNotificationsPage({ user: { actualRole: "SUPER_ADMIN" }, location: { search: "" } }));

    await act(async () => {
      await result.current.loadNotifications();
    });

    expect(notificationsApi.listNotificationsFiltered).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(notificationsApi.markAllNotificationsRead).toHaveBeenCalled();
  });
});
