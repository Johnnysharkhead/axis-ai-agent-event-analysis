/**
 * App.js is the main component.
 * Here we decide what the app shows (pages, layout, etc).
 */

import React from "react";
import "./styles/App.css";
import MainLayout from "./layouts/MainLayout";
import AppRoutes from "./routes.js";

function App() {
  return (
    <MainLayout>
      <AppRoutes />
    </MainLayout>
  );
}

export default App;