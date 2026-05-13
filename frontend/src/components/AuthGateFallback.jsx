import AppShellSkeleton from "./AppShellSkeleton";

export default function AuthGateFallback({
  title = "Loading page",
  detail = "Restoring your session, navigation, and workspace data.",
  status = "Loading",
}) {
  return <AppShellSkeleton title={title} detail={detail} status={status} />;
}
