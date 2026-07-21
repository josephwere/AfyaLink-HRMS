export function createDomainRuntime(manifest = {}) {
  const {
    name,
    queries = {},
    commands = {},
    cache,
    events,
    permissions,
    runtime,
  } = manifest;

  if (!name) {
    throw new Error("createDomainRuntime requires manifest.name");
  }

  const domainRuntime = {
    name,
    queries,
    commands,
    cache,
    events,
    permissions,
    runtime,
    manifest, // Store manifest for registry inspection
  };

  // Flatten queries and commands onto the runtime for backward compatibility
  return Object.assign(domainRuntime, queries, commands);
}

export default createDomainRuntime;

