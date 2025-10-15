/**
 * This layout files is a wrapper that shows Navbar + Footer on every page.
 * Pages are placed in the middle (children).
 */

import React, { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";

function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="container">
    
      <Navbar onToggleSidebar={handleToggleSidebar} isSidebarOpen={isSidebarOpen} />

      
      <div className="mainContent">
        <div className={`sidebarWrapper ${isSidebarOpen ? "open" : "collapsed"}`}>
          <Sidebar isOpen={isSidebarOpen} />
        </div>

        <div className="pageContent">
          <Outlet />
        </div>
      </div>

      
      <Footer />
    </div>
  );
}

export default MainLayout;
