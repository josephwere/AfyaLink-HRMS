import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PatientPrescriptions from "./Prescriptions";

vi.mock("../../hooks/usePatientPrescriptions", () => ({
  usePatientPrescriptions: () => ({
    items: [],
    referrals: [],
    filter: "ALL",
    setFilter: vi.fn(),
    loading: false,
    msg: "",
    visible: [],
    load: vi.fn(),
  }),
}));

describe("PatientPrescriptions", () => {
  it("renders the empty prescription workspace without falling into the app error boundary", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <PatientPrescriptions />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /prescriptions/i })).toBeInTheDocument();
    expect(screen.getByText(/no prescriptions yet/i)).toBeInTheDocument();
  });
});
