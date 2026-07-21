export function isDashboardRoute(pathname = "") {
  if (!pathname) return false;

  const normalized = pathname.replace(/\/+$/, "");
  const dashboardCandidates = [
    /\/dashboard(?:$|\/)/i,
    /\/home(?:$|\/)/i,
    /\/index(?:$|\/)/i,
  ];

  return dashboardCandidates.some((pattern) => pattern.test(normalized));
}

export function sortDashboardItems(items = []) {
  return [...items].sort((left, right) => {
    const leftPriority = left?.priority ?? 0;
    const rightPriority = right?.priority ?? 0;

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    const leftWorkspace = /workspace|overview|home/i.test(left?.title || "");
    const rightWorkspace = /workspace|overview|home/i.test(right?.title || "");

    if (leftWorkspace !== rightWorkspace) {
      return leftWorkspace ? -1 : 1;
    }

    return 0;
  });
}
