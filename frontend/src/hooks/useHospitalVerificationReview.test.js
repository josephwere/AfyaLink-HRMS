import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHospitalVerificationReview } from "./useHospitalVerificationReview";
import { downloadHospitalVerificationDocument, getHospitalVerificationReviewQueue, reviewHospitalVerification } from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  downloadHospitalVerificationDocument: vi.fn(),
  getHospitalVerificationReviewQueue: vi.fn(),
  reviewHospitalVerification: vi.fn(),
}));

describe("useHospitalVerificationReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the review queue and submits a decision", async () => {
    getHospitalVerificationReviewQueue.mockResolvedValueOnce({
      hospitals: [{ _id: "h1", name: "Example" }],
      branches: [],
    });
    reviewHospitalVerification.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useHospitalVerificationReview());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.queue.hospitals).toHaveLength(1);

    await act(async () => {
      await result.current.decide("h1", "APPROVE");
    });

    expect(reviewHospitalVerification).toHaveBeenCalledWith("h1", { decision: "APPROVE", reviewNotes: "" });
  });
});
