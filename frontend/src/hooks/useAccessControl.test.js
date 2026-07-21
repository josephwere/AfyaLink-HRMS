import React from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccessControl } from "./useAccessControl";
import * as delegatedPermissionsApi from "../services/delegatedPermissionsApi";

vi.mock("../services/delegatedPermissionsApi", () => ({
  getDelegationScope: vi.fn(),
  getUserDelegatedPermissions: vi.fn(),
  saveUserDelegatedPermissions: vi.fn(),
}));

describe("useAccessControl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads delegated scope through the service layer", async () => {
    delegatedPermissionsApi.getDelegationScope.mockResolvedValueOnce({ users: [{ _id: "u1", name: "Ada" }], permissionsCatalog: [] });

    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => React.createElement(MemoryRouter, null, children),
    });

    await act(async () => {
      await result.current.loadScope();
    });

    expect(delegatedPermissionsApi.getDelegationScope).toHaveBeenCalled();
    expect(result.current.scope.users?.[0]?.name).toBe("Ada");
  });
});
