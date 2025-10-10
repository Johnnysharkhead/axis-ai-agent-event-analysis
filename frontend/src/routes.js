/**
 * routes.js
 * Controls which page shows for which URL using React Router.
 * AUTHORS: Victor, Success, David
 *
 * /           -> Signup page
 * /login      -> Login page
 * /floormap2D -> Floormap2D page
 */
// Import all page components for routing
// AppRoutes: Main routing component for the app

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Signup from "./pages/Signup";
import Floormap2D from "./pages/Floormap2D";
import Login from "./pages/Login";
import MainLayout from "./layouts/MainLayout";
import LiveCameraPage from "./pages/LiveCameraPage.js";

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path="/" element={<Signup />} />
      <Route path="/login" element={<Login />} />

      {/* Private routes (with layout) */}
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Backward-compat redirect from old '/home' to '/dashboard' */}
        <Route path="/home" element={<Navigate to="/dashboard" replace />} />

        {/* Cameras */}
        <Route path="/video-feed/camera" element={<LiveCameraPage />} />

        {/* 2D Floorplan */}
        <Route path="/2d-floorplan/overview" element={<Floormap2D view="overview" />} />
        <Route path="/2d-floorplan/heatmap" element={<Floormap2D view="heatmap" />} />
        <Route path="/2d-floorplan/zones" element={<Floormap2D view="zones" />} />
        <Route path="/2d-floorplan/schedule-alarms" element={<Floormap2D view="schedule-alarms" />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
