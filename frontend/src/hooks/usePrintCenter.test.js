import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePrintCenter } from "./usePrintCenter";
import * as printingApi from "../services/printingApi";

vi.mock("../services/printingApi", () => ({
  createPrinterProfile: vi.fn(),
  getPrintingConnectors: vi.fn(),
  listPrinterProfiles: vi.fn(),
  listPrintJobs: vi.fn(),
  printHtmlDocument: vi.fn(),
  queuePrintJob: vi.fn(),
  updatePrinterProfile: vi.fn(),
  updatePrintJobStatus: vi.fn(),
}));

describe("usePrintCenter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads printer data and queues a test print", async () => {
    printingApi.listPrinterProfiles.mockResolvedValueOnce({ items: [{ _id: "1", name: "Printer", isDefault: true }] });
    printingApi.listPrintJobs.mockResolvedValueOnce({ items: [] });
    printingApi.getPrintingConnectors.mockResolvedValueOnce({ connectors: {} });
    printingApi.queuePrintJob.mockResolvedValueOnce({ job: { _id: "job-1" } });

    const { result } = renderHook(() => usePrintCenter({ user: { name: "Test" } }));

    await act(async () => {
      await result.current.load();
    });

    expect(printingApi.listPrinterProfiles).toHaveBeenCalled();
    expect(result.current.profiles).toHaveLength(1);

    await act(async () => {
      await result.current.queueTestPrint();
    });

    expect(printingApi.queuePrintJob).toHaveBeenCalled();
  });
});
