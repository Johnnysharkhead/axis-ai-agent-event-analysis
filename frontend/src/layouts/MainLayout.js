/**
 * This layout files is a wrapper that shows Navbar + Footer on every page.
 * Pages are placed in the middle (children).
 */

import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";

function MainLayout({ children }) {
  return (
<div className="container">
      {/* Top navigation bar */}
      <Navbar />

      {/* Main content area (sidebar + page) */}
      <div className="mainContent">
        <div className="sidebarWrapper">
          <Sidebar />
        </div>

        <div className="pageContent">
          {children}
        </div>
      </div>

      {/* Bottom footer */}
      <Footer />
    </div>
  );
}

export default MainLayout;
