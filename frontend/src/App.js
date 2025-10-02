/**
 * App.js is the main component.
 * Here we decide what the app shows (pages, layout, etc).
 */

import React from "react";
import "./styles/App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="App">
      <Navbar />
      <Home />
      <Footer />
    </div>
  );
}

export default App;