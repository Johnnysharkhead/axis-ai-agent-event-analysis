/**
 * This file controls which page shows for which URL.
 * Uses React Router.
 */

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Floormap2D from "./pages/Floormap2D";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/floormap2D" element={<Floormap2D />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;