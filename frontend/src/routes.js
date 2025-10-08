/**
 * This file controls which page shows for which URL.
 * Uses React Router.
 */

import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Cameras from "./pages/Cameras";
import Floormap2D from "./pages/Floormap2D";

function AppRoutes() {
  return (
    <Routes>
      {/* Dashboard */}
      <Route path="/" element={<Dashboard />} />

      {/* Cameras */}
      <Route path="/video-feed/camera-1" element={<Cameras camera="1" />} />
      <Route path="/video-feed/camera-2" element={<Cameras camera="2" />} />
      <Route path="/video-feed/camera-3" element={<Cameras camera="3" />} />

      {/* 2D Floorplan */}
      <Route path="/2d-floorplan/overview" element={<Floormap2D view="overview" />} />
      <Route path="/2d-floorplan/heatmap" element={<Floormap2D view="heatmap" />} />
      <Route path="/2d-floorplan/zones" element={<Floormap2D view="zones" />} />
      <Route path="/2d-floorplan/schedule-alarms" element={<Floormap2D view="schedule-alarms" />} />
    </Routes>
  );
}

export default AppRoutes;