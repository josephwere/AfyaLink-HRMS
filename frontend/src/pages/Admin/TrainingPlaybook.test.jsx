import { describe, expect, it } from "vitest";

import playbook from "../../../docs/role-training-playbook.md?raw";

const ROLE_HEADERS = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "DEVELOPER",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "SECURITY_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "PATIENT",
];

describe("role training playbook", () => {
  it("covers the full platform and every role with concrete training guidance", () => {
    expect(playbook).toContain("# AfyaLink Role Training Playbook");
    expect(playbook).toContain("## Platform Overview");
    expect(playbook).toContain("## Core System Areas");
    expect(playbook).toContain("## Training Pathway");
    expect(playbook).toContain("## Role-Based Mastery Map");
    expect(playbook).toContain("## Roles and Responsibilities");

    ROLE_HEADERS.forEach((role) => {
      expect(playbook).toContain(`## ${role}`);
    });

    [
      "Appointments",
      "Clinical Care",
      "Pharmacy",
      "Laboratory",
      "Billing & Payments",
      "Notifications",
      "Uploads & Documents",
      "Maps & Location Services",
      "Accessibility & Responsiveness",
      "Reporting & Analytics",
    ].forEach((moduleName) => {
      expect(playbook).toContain(moduleName);
    });
  });
});
