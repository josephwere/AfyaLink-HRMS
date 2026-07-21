import React from "react";
import { getAllDomains, getNavigationItems, validateDependencies, getStartupOrder } from "./domainRegistry.js";

function RuntimeRoutePlaceholder({ route }) {
  return React.createElement(
    "div",
    { style: { padding: "1.5rem" } },
    React.createElement("h2", null, route.title || "Runtime domain route"),
    React.createElement("p", null, route.path),
    React.createElement(
      "p",
      { style: { color: "#6b7280" } },
      "This route is currently served from the shared frontend runtime."
    )
  );
}

const runtime = {
  initialized: false,
  modules: [],
  navigationItems: [],
  routes: [],
};

const domainModuleLoaders = [
  () => import("../encounter/register.js"),
  () => import("../pharmacy/register.js"),
  () => import("../laboratory/register.js"),
  () => import("../radiology/register.js"),
  () => import("../workflow/register.js"),
  () => import("../billing/register.js"),
  () => import("../governance/register.js"),
];

function getRuntimeState() {
  return {
    initialized: runtime.initialized,
    modules: runtime.modules,
    navigationItems: runtime.navigationItems,
    routes: runtime.routes,
  };
}

export async function initializeFrontendRuntime({ userPermissions = [] } = {}) {
  if (runtime.initialized) {
    return getRuntimeState();
  }

  const modulePromises = domainModuleLoaders.map((loader) => loader());
  const loadedModules = await Promise.all(modulePromises);
  runtime.modules = loadedModules.map((module) => module.default || module);

  const domains = getAllDomains();
  const validation = validateDependencies();
  const startupOrder = getStartupOrder();

  runtime.navigationItems = getNavigationItems({ userPermissions });
  runtime.routes = domains
    .flatMap((domain) => {
      const manifest = domain.service?.manifest;
      if (!manifest) {
        return [];
      }

      const routes = [];
      const addRoute = (routePath, routeTitle, routeComponent, routeWorkspace) => {
        routes.push({
          path: routePath,
          title: routeTitle,
          workspace: routeWorkspace,
          element: routeComponent
            ? React.createElement(routeComponent)
            : React.createElement(RuntimeRoutePlaceholder, {
                route: {
                  path: routePath,
                  title: routeTitle,
                  workspace: routeWorkspace,
                },
              }),
        });
      };

      if (manifest.route) {
        addRoute(manifest.route, manifest.title || manifest.name, manifest.component || null, manifest.workspace);
      }

      if (Array.isArray(manifest.features)) {
        manifest.features.forEach((feature) => {
          if (feature.route) {
            addRoute(feature.route, feature.label || feature.id, feature.component || null, feature.workspace || manifest.workspace);
          }
        });
      }

      return routes;
    });

  runtime.initialized = validation.valid && Array.isArray(startupOrder) && startupOrder.length > 0;

  return getRuntimeState();
}

export function getFrontendRuntimeState() {
  return getRuntimeState();
}

export function getRuntimeRoutes() {
  return runtime.routes;
}

export function getRuntimeNavigationItems({ userPermissions = [] } = {}) {
  if (runtime.initialized) {
    return runtime.navigationItems.filter((item) => item.canAccess !== false);
  }

  return getNavigationItems({ userPermissions });
}

export function getRuntimeDependencies() {
  return {
    domains: getAllDomains().map((domain) => domain.name),
    validation: validateDependencies(),
    startupOrder: getStartupOrder(),
  };
}

export default {
  initializeFrontendRuntime,
  getFrontendRuntimeState,
  getRuntimeRoutes,
  getRuntimeNavigationItems,
  getRuntimeDependencies,
};
