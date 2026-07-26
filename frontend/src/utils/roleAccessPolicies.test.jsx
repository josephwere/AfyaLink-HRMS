import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RequireRole from "../components/RequireRole";
import { TRAINING_PLAYBOOK_ROLES, TRAINING_TRACKER_ROLES, canAccessTraining } from "./roleAccessPolicies";

vi.mock("../utils/auth", () => ({
  useAuth: () => ({
    user: { role: "HOSPITAL_ADMIN_ASSISTANT", actualRole: "HOSPITAL_ADMIN_ASSISTANT" },
    loading: false,
  }),
}));

vi.mock("../contexts/UserContextContext", () => ({
  useUserContext: () => ({ mode: "WORK" }),
}));

vi.mock("../contexts/contextRouteRules", () => ({
  getContextRedirectPath: () => null,
}));

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    configurable: true,
  });
});

describe("training access policies", () => {
  it("allows hospital admin assistants to reach training tracker and playbook routes", () => {
    expect(TRAINING_TRACKER_ROLES).toContain("HOSPITAL_ADMIN_ASSISTANT");
    expect(TRAINING_PLAYBOOK_ROLES).toContain("HOSPITAL_ADMIN_ASSISTANT");
    expect(canAccessTraining({ role: "HOSPITAL_ADMIN_ASSISTANT" })).toBe(true);
  });

  it("allows the guarded route to render for a hospital admin assistant", () => {
    render(
      <MemoryRouter initialEntries={["/training"]}>
        <Routes>
          <Route path="/training" element={<RequireRole roles={TRAINING_TRACKER_ROLES}><div>Training Page</div></RequireRole>} />
          <Route path="/unauthorized" element={<div>Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Training Page")).toBeTruthy();
  });
});
