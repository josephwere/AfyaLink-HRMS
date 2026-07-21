import { createResource } from "./createResource";

export function createDomainService({
  name,
  endpoint,
  api,
  queries = {},
  commands = {},
  actions = {},
} = {}) {
  if (!name) {
    throw new Error("createDomainService requires a domain name");
  }
  if (!endpoint) {
    throw new Error("createDomainService requires an endpoint");
  }

  return createResource({
    name,
    basePath: endpoint,
    api,
    queries,
    commands,
    actions,
  });
}
