import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PatientBilling() {
  return (
    <ModuleWorkspace
      title="Billing"
      subtitle="Invoices, outstanding balances, receipts and payment history."
      actions={[{ label: "Open Payments", variant: "primary", path: "/payments" }, { label: "Download Receipt" }]}
      panels={[
        { title: "Outstanding", body: "Pending invoices and due dates." },
        { title: "Paid", body: "Paid invoices and transaction history." },
        { title: "Receipts", body: "Receipt archive and exports." },
      ]}
    />
  );
}
