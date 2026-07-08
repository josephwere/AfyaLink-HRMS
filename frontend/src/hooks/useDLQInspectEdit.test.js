import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDLQInspectEdit from "./useDLQInspectEdit";

vi.mock("../services/dlqApi", () => ({
  listDlqItems: vi.fn(),
  updateDlqItem: vi.fn(),
  retryDlqItem: vi.fn(),
}));

import * as dlqApi from "../services/dlqApi";

describe("useDLQInspectEdit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads items and saves/retries", async () => {
    // hook mount, explicit load(), and view() may each call listDlqItems
    dlqApi.listDlqItems.mockResolvedValueOnce({ items: [{ id: "x", data: { a: 1 } }] });
    dlqApi.listDlqItems.mockResolvedValueOnce({ items: [{ id: "x", data: { a: 1 } }] });
    dlqApi.listDlqItems.mockResolvedValueOnce({ items: [{ id: "x", data: { a: 1 } }] });
    dlqApi.updateDlqItem.mockResolvedValueOnce({ ok: true });
    dlqApi.retryDlqItem.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useDLQInspectEdit());

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.view("x");
    });

    expect(result.current.selected.id).toBe("x");

    act(() => result.current.setEditData(JSON.stringify({ a: 2 })));

    await act(async () => {
      await result.current.save();
    });

    expect(dlqApi.updateDlqItem).toHaveBeenCalledWith("x", { a: 2 });

    await act(async () => {
      await result.current.retry();
    });

    expect(dlqApi.retryDlqItem).toHaveBeenCalledWith("x");
  });
});
