/**
 * App.js is the main component.
 * Here we decide what the app shows (pages, layout, etc).
 */

import React from "react";
import "./styles/App.css";
import AppRoutes from "./routes.js";

function App() {
  return (
    <div className="App">
      <AppRoutes />
    </div>
  );
}

export default App;