import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDLQInspector from "./useDLQInspector";

vi.mock("../services/dlqEditorApi", () => ({ listDlq: vi.fn() }));
vi.mock("../services/dlqApi", () => ({ retryDlqItem: vi.fn() }));

import * as editorApi from "../services/dlqEditorApi";
import * as dlqApi from "../services/dlqApi";

describe("useDLQInspector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads items and retries an item", async () => {
    editorApi.listDlq.mockResolvedValueOnce([{ id: "1", failedReason: "x" }]);
    editorApi.listDlq.mockResolvedValueOnce([{ id: "1", failedReason: "x" }]);
    dlqApi.retryDlqItem.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useDLQInspector());

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.retry("1");
    });

    expect(dlqApi.retryDlqItem).toHaveBeenCalledWith("1");
  });
});
