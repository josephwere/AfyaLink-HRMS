import { jest } from "@jest/globals";

process.env.NEUROEDGE_API_KEY = process.env.NEUROEDGE_API_KEY || "pilot_test_key";

class MockNeuroEdgeGatewayError extends Error {
  constructor(message, { status = 502, code = "NEUROEDGE_ERROR", details = null } = {}) {
    super(message);
    this.name = "NeuroEdgeGatewayError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const mockClient = {
  chatCompletions: jest.fn(),
  chatStream: jest.fn(),
  feedback: jest.fn(),
};

jest.unstable_mockModule("../services/neuroedgeGatewayClient.js", () => ({
  neuroedgeGatewayClient: mockClient,
  NeuroEdgeGatewayError: MockNeuroEdgeGatewayError,
}));

const { assistantChatStream, assistantFeedback } = await import("../services/aiAdapter.js");

describe("AI adapter NeuroEdge rate limiting", () => {
  beforeEach(() => {
    Object.values(mockClient).forEach((fn) => fn.mockReset());
  });

  test("streams a friendly fallback when NeuroEdge is rate limited", async () => {
    mockClient.chatStream.mockRejectedValue(
      new MockNeuroEdgeGatewayError("busy", {
        status: 429,
        code: "NEUROEDGE_RATE_LIMITED",
        details: { retryAfterMs: 12000, retryAfterSeconds: 12 },
      })
    );

    const chunks = [];
    const out = await assistantChatStream({
      message: "Need help",
      role: "PATIENT",
      pageContext: "/app/innovation/ai/chatbot",
      healthProfile: {},
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(out.provider).toBe("neuroedge-rate-limited");
    expect(out.degraded).toBe(true);
    expect(out.retryAfterMs).toBe(12000);
    expect(out.text).toContain("busy right now");
    expect(out.text).toContain("12 seconds");
    expect(chunks.join(" ")).toContain("busy right now");
  });

  test("returns retryable feedback metadata when NeuroEdge is rate limited", async () => {
    mockClient.feedback.mockRejectedValue(
      new MockNeuroEdgeGatewayError("busy", {
        status: 429,
        code: "NEUROEDGE_RATE_LIMITED",
        details: { retryAfterMs: 9000, retryAfterSeconds: 9 },
      })
    );

    const out = await assistantFeedback({
      message: "Question",
      answer: "Answer",
      rating: "down",
      reason: "wrong",
      metadata: { pageContext: "/app/innovation/ai/chatbot" },
    });

    expect(out.accepted).toBe(false);
    expect(out.degraded).toBe(true);
    expect(out.retryable).toBe(true);
    expect(out.retryAfterMs).toBe(9000);
    expect(out.retryAfterSeconds).toBe(9);
    expect(out.message).toContain("Please try again in about 9 seconds");
  });
});
