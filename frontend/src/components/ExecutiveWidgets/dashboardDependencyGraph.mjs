function createDashboardDependencyGraph() {
  const nodes = new Map();

  function registerWidget(widget) {
    const entry = {
      id: widget?.id,
      dataSource: widget?.dataSource,
      dependsOn: Array.isArray(widget?.dependsOn) ? widget.dependsOn.filter(Boolean) : [],
      dependents: [],
    };

    nodes.set(entry.id, entry);
    entry.dependsOn.forEach((dependencyId) => {
      const dependency = nodes.get(dependencyId) ?? { id: dependencyId, dependsOn: [], dependents: [] };
      dependency.dependents = dependency.dependents ?? [];
      if (!dependency.dependents.includes(entry.id)) {
        dependency.dependents.push(entry.id);
      }
      nodes.set(dependencyId, dependency);
    });

    return entry;
  }

  function getAffectedNodes(changedNodeId) {
    const visited = new Set();
    const stack = [changedNodeId];

    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);

      const node = nodes.get(current);
      if (node?.dependents?.length) {
        node.dependents.forEach((dependentId) => {
          if (!visited.has(dependentId)) {
            stack.push(dependentId);
          }
        });
      }
    }

    return Array.from(visited).filter((nodeId) => nodeId !== changedNodeId);
  }

  function getNode(nodeId) {
    return nodes.get(nodeId) ?? null;
  }

  function toJSON() {
    return Array.from(nodes.values()).map((node) => ({
      id: node.id,
      dataSource: node.dataSource,
      dependsOn: node.dependsOn,
      dependents: node.dependents,
    }));
  }

  return {
    registerWidget,
    getAffectedNodes,
    getNode,
    toJSON,
  };
}

export { createDashboardDependencyGraph };
export default createDashboardDependencyGraph;
