function createDashboardExecutionPlanner(options = {}) {
  const { graph } = options;

  function createPlan(rootNodes = []) {
    const visiting = new Set();
    const visited = new Set();
    const order = [];
    const nodeIds = new Set([...rootNodes]);

    const visit = (nodeId) => {
      if (!nodeId || visited.has(nodeId)) return;
      if (visiting.has(nodeId)) return;

      visiting.add(nodeId);
      const node = graph?.getNode?.(nodeId);
      const dependencies = Array.isArray(node?.dependsOn) ? [...node.dependsOn].sort() : [];

      dependencies.forEach((dependencyId) => {
        nodeIds.add(dependencyId);
        visit(dependencyId);
      });

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    [...rootNodes].forEach((nodeId) => visit(nodeId));
    const sequential = order.filter((nodeId, index) => order.indexOf(nodeId) === index);
    return {
      sequential,
      parallel: [],
      rootNodes: [...rootNodes],
    };
  }

  return {
    createPlan,
  };
}

export { createDashboardExecutionPlanner };
export default createDashboardExecutionPlanner;
