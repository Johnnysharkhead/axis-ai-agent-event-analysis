/**
 * This layout files is a wrapper that shows Navbar + Footer on every page.
 * Pages are placed in the middle (children).
 */

import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function MainLayout({ children }) {
  return (
    <div>
      <Navbar />
      <div style={{ padding: "1rem" }}>{children}</div>
      <Footer />
    </div>
  );
}

export default MainLayout;
