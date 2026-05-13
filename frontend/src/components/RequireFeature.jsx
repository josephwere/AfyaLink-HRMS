import { Navigate } from "react-router-dom";
import { useHospitalConfig } from "../hooks/useHospitalConfig";
import AuthGateFallback from "./AuthGateFallback";

export default function RequireFeature({ feature, children }) {
  const { features, loading } = useHospitalConfig();

  if (loading) {
    return (
      <AuthGateFallback
        title="Opening page"
        detail="Checking facility features before this page loads."
      />
    );
  }

  if (!features[feature]) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
