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

export function getContextRedirectPath(pathname = "", currentContext = "WORK") {
  const normalizedPath = normalizePath(pathname);
  const requiredContext = resolveRequiredContext(normalizedPath);
  if (!requiredContext || requiredContext === currentContext) return null;

  let redirectTarget = "/app/operations/home/index";
  if (requiredContext === "MY_HEALTH" || currentContext === "MY_HEALTH") {
    redirectTarget = "/app/portal/home/index";
  }

  if (redirectTarget === normalizedPath) {
    return null;
  }

  return redirectTarget;
}
