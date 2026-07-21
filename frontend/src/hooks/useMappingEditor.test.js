import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMappingEditor } from "./useMappingEditor";
import * as mappingStudioApi from "../services/mappingStudioApi";

vi.mock("../services/mappingStudioApi", () => ({
  listMappings: vi.fn(),
  getMapping: vi.fn(),
  createMapping: vi.fn(),
  updateMapping: vi.fn(),
  deleteMapping: vi.fn(),
  listMappingTemplates: vi.fn(),
  previewMapping: vi.fn(),
  signMappingPayload: vi.fn(),
  verifyMappingPayload: vi.fn(),
}));

describe("useMappingEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads mappings through the service layer", async () => {
    mappingStudioApi.listMappings.mockResolvedValueOnce([{ _id: "m1", name: "Demo" }]);

    const { result } = renderHook(() => useMappingEditor());

    await act(async () => {
      await result.current.load();
    });

    expect(mappingStudioApi.listMappings).toHaveBeenCalled();
    expect(result.current.list[0].name).toBe("Demo");
  });
});
