/**
 * App.js is the main component.
 * Here we decide what the app shows (pages, layout, etc).
 */

import React, { useEffect } from "react";
import "./styles/App.css";
import AppRoutes from "./routes.js";
import { applyTheme, getSavedTheme, THEME_EVENT } from "./utils/theme";

function App() {
  useEffect(() => {
    const saved = getSavedTheme();
    applyTheme(saved);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: saved }));
    }
  }, []);

  return (
    <div className="App">
      <AppRoutes />
    </div>
  );
}

export default App;
