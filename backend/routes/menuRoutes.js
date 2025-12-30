import express from "express";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ======================================================
   🧭 DYNAMIC MENU CONFIG (ROLE-BASED)
====================================================== */

const MENU_BY_ROLE = {
  SUPER_ADMIN: [
    {
      section: "Super Admin",
      items: [
        { label: "Dashboard", path: "/superadmin" },
        { label: "RBAC", path: "/superadmin/rbac" },
        { label: "ML", path: "/superadmin/ml" },
        { label: "Analytics", path: "/analytics" },
        { label: "Reports", path: "/reports" },
        { label: "Audit Logs", path: "/admin/audit-logs" },
        { label: "Create Admin", path: "/admin/create-admin" },
      ],
    },
  ],

  HOSPITAL_ADMIN: [
    {
      section: "Hospital Admin",
      items: [
        { label: "Dashboard", path: "/hospitaladmin" },
        { label: "Patients", path: "/hospitaladmin/patients" },
        { label: "Financials", path: "/hospitaladmin/financials" },
        { label: "Branches", path: "/hospitaladmin/branches" },
        { label: "Inventory", path: "/inventory" },
        { label: "Pharmacy", path: "/pharmacy" },
      ],
    },
    {
      section: "Integrations",
      items: [
        { label: "Webhooks", path: "/admin/realtime" },
        { label: "CRDT Editor", path: "/admin/crdt-patients" },
        { label: "Notifications", path: "/admin/notifications" },
      ],
    },
  ],

  DOCTOR: [
    {
      section: "Doctor",
      items: [
        { label: "Dashboard", path: "/doctor" },
        { label: "Appointments", path: "/doctor/appointments" },
        { label: "AI Assistant", path: "/ai/medical" },
        { label: "Triage", path: "/ai/triage" },
        { label: "Voice Dictation", path: "/ai/voice" },
      ],
    },
  ],

  NURSE: [
    {
      section: "Nurse",
      items: [
        { label: "AI Assistant", path: "/ai/medical" },
        { label: "Triage", path: "/ai/triage" },
      ],
    },
  ],

  LAB_TECH: [
    {
      section: "Laboratory",
      items: [
        { label: "Lab Tests", path: "/labtech/labs" },
        { label: "Lab Dashboard", path: "/lab" },
      ],
    },
  ],

  PATIENT: [
    {
      section: "Patient",
      items: [
        { label: "Dashboard", path: "/patient" },
        { label: "Payments", path: "/payments" },
        { label: "Health Chatbot", path: "/ai/chatbot" },
      ],
    },
  ],
};

/* ======================================================
   📡 GET MENU FOR LOGGED-IN USER
====================================================== */
router.get("/", protect, (req, res) => {
  const role = req.user.role;
  const menu = MENU_BY_ROLE[role] || [];

  res.json({
    role,
    menu,
  });
});

export default router;
