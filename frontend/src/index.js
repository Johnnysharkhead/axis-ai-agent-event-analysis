/**
 * This file starts the React app.
 * It looks for <div id="root"> in index.html
 * and puts the <App /> component inside it.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
