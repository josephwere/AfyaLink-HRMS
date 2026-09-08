import { jest } from "@jest/globals";

const outboxFindMock = jest.fn();
const outboxFindByIdAndUpdateMock = jest.fn();
const publishMock = jest.fn();

jest.unstable_mockModule("../models/OutboxEvent.js", () => ({
  default: {
    find: outboxFindMock,
    findByIdAndUpdate: outboxFindByIdAndUpdateMock,
  },
}));

jest.unstable_mockModule("../services/eventPublisher.js", () => ({
  default: { publish: publishMock },
  publish: publishMock,
}));

describe("outbox worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks a pending event as sent after a successful publish", async () => {
    outboxFindMock.mockResolvedValueOnce([
      {
        _id: "event-1",
        eventName: "PaymentReceived",
        payload: { amount: 100 },
        attempts: 0,
        status: "PENDING",
        createdAt: new Date(),
      },
    ]);
    outboxFindByIdAndUpdateMock.mockResolvedValue({});
    publishMock.mockResolvedValue(true);

    const { processPendingOutboxEvents } = await import("../services/outboxWorkerService.js");
    await processPendingOutboxEvents({ limit: 10, now: new Date() });

    expect(publishMock).toHaveBeenCalledWith("PaymentReceived", { amount: 100 });
    expect(outboxFindByIdAndUpdateMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ $set: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("dead-letters an event after the retry limit is reached", async () => {
    outboxFindMock.mockResolvedValueOnce([
      {
        _id: "event-2",
        eventName: "InvoiceIssued",
        payload: { invoiceId: "inv-2" },
        attempts: 4,
        status: "PENDING",
        createdAt: new Date(),
      },
    ]);
    outboxFindByIdAndUpdateMock.mockResolvedValue({});
    publishMock.mockResolvedValue(false);

    const { processPendingOutboxEvents } = await import("../services/outboxWorkerService.js");
    await processPendingOutboxEvents({ limit: 10, now: new Date() });

    expect(outboxFindByIdAndUpdateMock).toHaveBeenCalledWith(
      "event-2",
      expect.objectContaining({ $set: expect.objectContaining({ status: "FAILED" }) })
    );
  });
});
