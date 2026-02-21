import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function SupplierOrders() {
  return (
    <ModuleWorkspace
      title="Supplier Orders"
      subtitle="Purchase order workflow, supplier lead times and delivery tracking."
      actions={[{ label: "Create PO", variant: "primary" }, { label: "Track Deliveries" }]}
      panels={[
        { title: "Open Orders", body: "Purchase orders awaiting fulfillment." },
        { title: "Deliveries", body: "Incoming shipment and receiving logs." },
        { title: "Supplier Performance", body: "Lead-time and reliability metrics." },
      ]}
    />
  );
}
