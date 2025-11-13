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

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import MainLayout from "./layouts/MainLayout";
import LiveCameraPage from "./pages/LiveCameraPage.js";
import RecordingLibraryPage from "./pages/RecordingLibrary.js";
import VideoRecordingPage from "./pages/VideoRecording.js";
import Floormap2D from "./pages/Floormap2D";
import EventHistoryPage from "./pages/EventHistoryPage";
import Profile from "./pages/Profile";
import CameraConfig from "./pages/CameraConfig";
import { isAuthenticated } from "./utils/api";


function ProtectedRoute({ children }) {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    isAuthenticated().then(setAuth);
  }, []);

  if (auth === null) return null; // optional loading placeholder
  return auth ? children : <Navigate to="/login" replace />;
}

// Public routes (only for guests)
function PublicRoute({ children }) {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    isAuthenticated().then(setAuth);
  }, []);

  if (auth === null) return null;
  return !auth ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes (no layout) */}
     <Route path="/" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Private routes (with layout) */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Backward-compat redirect from old '/home' to '/dashboard' */}
        <Route path="/home" element={<Navigate to="/dashboard" replace />} />

        {/* Cameras */}
        <Route path="/video-feed/camera" element={<LiveCameraPage />} />
        <Route path="/video-feed/live-camera" element={<LiveCameraPage />} />
        <Route path="/video-feed/video-recording" element={<VideoRecordingPage />} />
        <Route path="/video-feed/recording-library" element={<RecordingLibraryPage />} />
        <Route path="/cameras/configure" element={<CameraConfig />} />

        {/* Alarms */}
        <Route path="/alarms/alarm-history" element={<EventHistoryPage />} />

        {/* Profile */}
        <Route path="/profile" element={<Profile />} />

        {/* 2D Floorplan */}
        <Route path="/2d-floorplan/configuration" element={<Floormap2D view="configuration" />} />
        <Route path="/2d-floorplan/heatmap" element={<Floormap2D view="heatmap" />} />
        <Route path="/2d-floorplan/zones" element={<Floormap2D view="zones" />} />
        <Route path="/2d-floorplan/schedule-alarms" element={<Floormap2D view="schedule-alarms" />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
