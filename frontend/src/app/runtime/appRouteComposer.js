import React from "react";
import { Route } from "react-router-dom";
import { getRuntimeRoutes } from "../../services/shared/frontendRuntime";

export function createRuntimeRouteElements() {
  const routes = getRuntimeRoutes();

  return routes.map((route) =>
    React.createElement(Route, {
      key: route.path,
      path: route.path,
      element: route.element || null,
    })
  );
}
