import React from "react";
import { useNavigate } from "react-router-dom";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function InventoryPage() {
  const navigate = useNavigate();

  return (
    <ModuleWorkspace
      title="Inventory"
      subtitle="Stock visibility, reorder thresholds and replenishment management."
      actions={[{ label: "Open Inventory", variant: "primary", onClick: () => navigate("/inventory") }, { label: "Reorder Planner" }]}
      panels={[
        { title: "Stock Levels", body: "Current quantity by item and category." },
        { title: "Low Stock", body: "Items below configured safety threshold." },
        { title: "Reorder", body: "Supplier reorder planning and execution." },
      ]}
    />
  );
}
