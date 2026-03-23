import AccessDeniedCard from "../components/AccessDeniedCard";

export default function Unauthorized() {
  return (
    <AccessDeniedCard
      title="Access denied"
      message="This page is not available for the current role view. Open the Role View Switcher and move into the correct operating context."
    />
  );
}
