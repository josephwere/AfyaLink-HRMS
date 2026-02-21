export function buildMenu({ user, hospital }) {
  const menu = [];

  /* ================= SUPER ADMIN ================= */
  if (user.role === "SUPER_ADMIN") {
    menu.push({
      section: "Security",
      items: [
        hospital?.features?.adminCreation && {
          label: "Create Admin",
          path: "/admin/create-admin",
        },
        hospital?.features?.auditLogs && {
          label: "Audit Logs",
          path: "/admin/audit-logs",
        },
      ].filter(Boolean),
    });
  }

  /* ================= AI ================= */
  if (hospital?.features?.ai) {
    menu.push({
      section: "AI",
      items: [
        { label: "Medical Assistant", path: "/ai/medical" },
        { label: "Triage", path: "/ai/triage" },
        { label: "Chatbot", path: "/ai/chatbot" },
      ],
    });
  }

  /* ================= FINANCE ================= */
  if (hospital?.features?.payments) {
    menu.push({
      section: "Finance",
      items: [
        { label: "Payments", path: "/payments" },
        { label: "Advanced Payments", path: "/payments/full" },
      ],
    });
  }

  /* ================= LAB ================= */
  if (hospital?.features?.lab) {
    menu.push({
      section: "Laboratory",
      items: [
        { label: "Lab Tests", path: "/labtech/labs" },
        { label: "Lab Dashboard", path: "/lab" },
      ],
    });
  }

  /* ================= REALTIME ================= */
  if (hospital?.features?.realtime) {
    menu.push({
      section: "Realtime",
      items: [{ label: "Live AI Chat", path: "/ai/ws" }],
    });
  }

  return menu.filter((s) => s.items.length > 0);
    }
