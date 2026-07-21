import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSystemAdminMigrations } from "./useSystemAdminMigrations";
import * as systemAdminApi from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  listMigrationProjects: vi.fn(),
  createMigrationProject: vi.fn(),
  startMigrationDryRun: vi.fn(),
}));

describe("useSystemAdminMigrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    systemAdminApi.listMigrationProjects.mockResolvedValue({ items: [{ _id: "m-1", name: "Alpha" }] });
    systemAdminApi.createMigrationProject.mockResolvedValue({ ok: true });
    systemAdminApi.startMigrationDryRun.mockResolvedValue({ ok: true });
  });

  it("loads migration projects and submits a new project", async () => {
    const { result } = renderHook(() => useSystemAdminMigrations());

    await act(async () => {
      await result.current.load();
      await result.current.createProject({ preventDefault: vi.fn() });
    });

    expect(systemAdminApi.listMigrationProjects).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);
  });
});
