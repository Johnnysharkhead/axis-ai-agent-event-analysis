/**
 * This file controls which page shows for which URL.
 * Uses React Router.
 */

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Cameras from "./pages/Cameras";
import Floormap2D from "./pages/Floormap2D";

export const appRouteConfig = [
  { path: "/",            label: "Dashboard",   Component: Dashboard },
  { path: "/cameras",     label: "Cameras",     Component: Cameras },
  { path: "/floormap2D",  label: "Floormap 2D", Component: Floormap2D },
];

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {appRouteConfig.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;