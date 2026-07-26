import { canUseMyHealthContext, isPatientContextUser } from "./userContextModel";

const WORK_ROUTE_PREFIXES = [
  "/app/care",
  "/app/operations",
  "/app/revenue",
  "/app/people",
  "/app/platform",
  "/app/governance",
  "/app/innovation",
];

const MY_HEALTH_ROUTE_PREFIXES = ["/app/portal"];

function normalizePath(pathname = "") {
  return String(pathname || "").trim();
}

export function resolveRequiredContext(pathname = "") {
  const path = normalizePath(pathname);
  if (MY_HEALTH_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) return "MY_HEALTH";
  if (WORK_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) return "WORK";
  return null;
}

export function getContextRedirectPath(pathname = "", currentContext = "WORK", user = null) {
  const normalizedPath = normalizePath(pathname);
  const requiredContext = resolveRequiredContext(normalizedPath);
  if (!requiredContext || requiredContext === currentContext) return null;

  // Let direct navigation drive the context mode. Redirecting here creates
  // route loops when a stored My Health preference meets a staff/admin work URL.
  if (requiredContext === "WORK") {
    return null;
  }

  if (requiredContext === "MY_HEALTH" && canUseMyHealthContext(user)) {
    return null;
  }

  const redirectTarget = "/app/portal/home/index";
  return redirectTarget === normalizedPath ? null : redirectTarget;
}
