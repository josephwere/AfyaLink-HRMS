
import { Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import Pharmacy from "./pages/Pharmacy";
import Inventory from "./pages/Inventory";
import Lab from "./pages/Lab";
import Audit from "./pages/Audit";

export default function Router() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/audit" element={<Audit />} />
      </Route>
    </Routes>
  );
}
