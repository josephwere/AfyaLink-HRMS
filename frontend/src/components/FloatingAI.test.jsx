import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import FloatingAI from "./FloatingAI";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: "/app/care/medications/prescriptions" }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../utils/systemSettings.jsx", () => ({
  useSystemSettings: () => ({ settings: { ai: { enabled: true, name: "NeuroEdge" }, monetization: { featureAccess: { ai: "FREE" } } } }),
}));

vi.mock("../utils/auth", () => ({
  useAuth: () => ({ user: { id: "u1", role: "DOCTOR" }, loading: false }),
}));

vi.mock("../context/AIContextProvider", () => ({
  useAIContext: () => ({ aiContext: {} }),
}));

describe("FloatingAI", () => {
  it("opens the assistant from a launcher action", async () => {
    render(<FloatingAI />);
    const button = screen.getByRole("button", { name: /neuroedge assistant/i });
    expect(button).toBeInTheDocument();
  });
});
