import apiFetch from "../../utils/apiFetch";
import { serializeQuery, joinPath } from "./apiResource";

export function createResource({
  name,
  basePath,
  api = apiFetch,
  queries = {},
  commands = {},
  actions = {},
} = {}) {
  const normalizePath = (path) => (path.startsWith("/") ? path : `/${path}`);
  const root = normalizePath(basePath || name || "");

  const resource = {
    list: async (query = {}) => {
      const qs = serializeQuery(query);
      return api(`${root}${qs ? `?${qs}` : ""}`);
    },

    get: async (id) => {
      if (id === undefined || id === null || id === "") return null;
      return api(`${root}/${encodeURIComponent(String(id))}`);
    },

    create: async (payload) => api(root, { method: "POST", body: payload }),

    update: async (id, payload) =>
      api(`${root}/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body: payload,
      }),

    remove: async (id) =>
      api(`${root}/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      }),

    query: async (queryName, payload = {}) => {
      const handler = queries[queryName];
      if (typeof handler !== "function") {
        throw new Error(`Unknown query: ${queryName}`);
      }
      return handler({ api, root, payload, serializeQuery, joinPath });
    },

    command: async (commandName, payload = {}) => {
      const handler = commands[commandName] || actions[commandName];
      if (typeof handler !== "function") {
        throw new Error(`Unknown command: ${commandName}`);
      }
      return handler({ api, root, payload, serializeQuery, joinPath });
    },
  };

  return Object.assign(resource, queries, commands, actions);
}
