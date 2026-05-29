import { jest } from "@jest/globals";

process.env.NEUROEDGE_API_BASE = process.env.NEUROEDGE_API_BASE || "https://neuroedge.test";
process.env.NEUROEDGE_API_KEY = process.env.NEUROEDGE_API_KEY || "pilot_test_key";
process.env.NEUROEDGE_RETRIES = "0";
process.env.NEUROEDGE_RETRY_BACKOFF_MS = "1";
process.env.NEUROEDGE_CIRCUIT_THRESHOLD = "5";
process.env.NEUROEDGE_CIRCUIT_COOLDOWN_MS = "15000";

const fetchMock = jest.fn();

jest.unstable_mockModule("node-fetch", () => ({
  default: fetchMock,
}));

const { neuroedgeGatewayClient } = await import("../services/neuroedgeGatewayClient.js");

function mockJsonResponse(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name || "").toLowerCase()] ?? headers[name] ?? null;
      },
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

describe("NeuroEdge gateway rate limiting", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("surfaces retry-after details and opens the circuit on 429", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(
        429,
        { message: "Too many requests" },
        { "retry-after": "12" }
      )
    );

    await expect(
      neuroedgeGatewayClient.chatCompletions({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toMatchObject({
      status: 429,
      code: "NEUROEDGE_RATE_LIMITED",
      details: expect.objectContaining({
        retryAfterMs: 12000,
        retryAfterSeconds: 12,
      }),
    });

    fetchMock.mockClear();

    await expect(
      neuroedgeGatewayClient.chatCompletions({ messages: [{ role: "user", content: "hi again" }] })
    ).rejects.toMatchObject({
      status: 429,
      code: "NEUROEDGE_RATE_LIMITED",
      details: expect.objectContaining({
        circuitOpen: true,
        retryAfterSeconds: expect.any(Number),
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
