import { Navigate } from "react-router-dom";
import { useHospitalConfig } from "../hooks/useHospitalConfig";

export default function RequireFeature({ feature, children }) {
  const { features, loading } = useHospitalConfig();

  if (loading) return null;

  if (!features[feature]) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
