import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDLQEditor from "./useDLQEditor";

vi.mock("../services/dlqEditorApi", () => ({
  listDlq: vi.fn(),
  viewDlq: vi.fn(),
  editRetry: vi.fn(),
}));

import * as dlqApi from "../services/dlqEditorApi";

describe("useDLQEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads items and allows view/save", async () => {
    dlqApi.listDlq.mockResolvedValueOnce({ items: [{ id: "1", failedReason: "err" }] });
    dlqApi.viewDlq.mockResolvedValueOnce({ id: "1", data: { a: 1 } });
    dlqApi.editRetry.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useDLQEditor());

    await act(async () => {
      await result.current.load();
    });

    expect(dlqApi.listDlq).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.view("1");
    });

    expect(dlqApi.viewDlq).toHaveBeenCalledWith("1");
    expect(result.current.selected.id).toBe("1");

    // update payload and save
    act(() => {
      result.current.setPayload(JSON.stringify({ a: 2 }));
    });

    await act(async () => {
      await result.current.saveAndRetry("1");
    });

    expect(dlqApi.editRetry).toHaveBeenCalledWith("1", { a: 2 });
  });
});
