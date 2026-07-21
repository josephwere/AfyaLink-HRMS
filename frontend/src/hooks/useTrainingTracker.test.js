import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrainingTracker } from "./useTrainingTracker";
import * as trainingTrackerApi from "../services/trainingTrackerApi";

vi.mock("../services/trainingTrackerApi", () => ({
  listTrainingTrackers: vi.fn(),
  updateTrainingDay: vi.fn(),
  upsertTrainingTracker: vi.fn(),
}));

describe("useTrainingTracker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and updates training trackers through the service layer", async () => {
    trainingTrackerApi.listTrainingTrackers.mockResolvedValueOnce({ items: [{ _id: "1", status: "IN_PROGRESS" }] });
    trainingTrackerApi.upsertTrainingTracker.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTrainingTracker({
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
      user: { hospital: "h1" },
      isGlobal: false,
    }));

    await act(async () => {
      await result.current.loadItems();
    });

    expect(trainingTrackerApi.listTrainingTrackers).toHaveBeenCalled();
    expect(result.current.items[0].status).toBe("IN_PROGRESS");

    act(() => {
      result.current.setManualName("Alicia");
      result.current.setTraineeRole("DOCTOR");
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(trainingTrackerApi.upsertTrainingTracker).toHaveBeenCalled();
  });
});
