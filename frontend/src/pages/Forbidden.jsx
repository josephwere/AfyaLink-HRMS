import AccessDeniedCard from "../components/AccessDeniedCard";

export default function Forbidden() {
  return (
    <AccessDeniedCard
      title="403 — Forbidden"
      message="This route is blocked for the current account or role view. Switch role view or return to a page you are authorized to operate."
    />
  );
}
