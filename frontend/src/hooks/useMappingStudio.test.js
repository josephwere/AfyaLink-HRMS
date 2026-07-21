import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMappingStudio } from "./useMappingStudio";
import {
  createMapping,
  deleteMapping,
  listMappingTemplates,
  listMappings,
  previewMapping,
  signMappingPayload,
  updateMapping,
  verifyMappingPayload,
} from "../services/mappingStudioApi";

vi.mock("../services/mappingStudioApi", () => ({
  createMapping: vi.fn(),
  deleteMapping: vi.fn(),
  listMappingTemplates: vi.fn(),
  listMappings: vi.fn(),
  previewMapping: vi.fn(),
  signMappingPayload: vi.fn(),
  updateMapping: vi.fn(),
  verifyMappingPayload: vi.fn(),
}));

describe("useMappingStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads mappings and templates", async () => {
    listMappings.mockResolvedValueOnce([{ _id: "m1", messageType: "ORM^O01" }]);
    listMappingTemplates.mockResolvedValueOnce({ templates: [{ id: "t1", title: "Demo" }] });

    const { result } = renderHook(() => useMappingStudio());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(listMappings).toHaveBeenCalled();
    expect(listMappingTemplates).toHaveBeenCalled();
    expect(result.current.mappings).toHaveLength(1);
    expect(result.current.templates).toHaveLength(1);
  });

  it("creates a mapping and refreshes the list", async () => {
    listMappings.mockResolvedValueOnce([]);
    listMappingTemplates.mockResolvedValueOnce({ templates: [] });
    createMapping.mockResolvedValueOnce({});
    listMappings.mockResolvedValueOnce([{ _id: "m1" }]);

    const { result } = renderHook(() => useMappingStudio());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.save();
    });

    expect(createMapping).toHaveBeenCalled();
    expect(result.current.mappings).toHaveLength(1);
  });
});
