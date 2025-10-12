/**
 * Navbar component (develop style) with Login and Signup buttons.
 */
/**
 * Example of a reusable component (Navbar).
 * Components = small UI building blocks that can be used across multiple pages.
 * AUTHOR: Rasmus, Emil
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Navbar.css";
import logo from "../assets/Axis_logo.png";
import settingsIcon from "../assets/settings_icon.png";
import bellLogo from "../assets/bell_logo.png";
import { logoutUser } from "../utils/api";

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // ignore error; proceed to redirect
    } finally {
      navigate('/login', { replace: true });
    }
  };
  return (
    <nav>
      <div className="navbar-container">
        <button className="hamburger-menu">☰</button>

        <div className="navbar-logo-search">
          <div className="navbar-logo">
            <img src={logo} alt="Company Logo" />
          </div>
          <div className="navbar-text">
            <strong>Axis Analytics</strong>
            <div>SaaS Platform</div>
          </div>
          <div className="navbar-search">
            <input type="text" placeholder="Search..." />
          </div>
        </div>

        <div className="navbar-actions">
          <div className="navbar-dropdowns">
            <div className="dropdown">
              <button className="dropbtn">Invoice</button>
              <div className="dropdown-content">
                <a href="#">View Invoices</a>
                <a href="#">Create Invoice</a>
              </div>
            </div>
            <div className="dropdown">
              <button className="dropbtn">Add</button>
              <div className="dropdown-content">
                <a href="#">Add Product</a>
                <a href="#">Add Service</a>
              </div>
            </div>
            <div className="dropdown">
              <button className="dropbtn">Accounts</button>
              <div className="dropdown-content">
                <a href="#">Manage Accounts</a>
                <a href="#">Account Settings</a>
              </div>
            </div>
          </div>

          <div className="navbar-divider"></div>

          <button className="navbar-button settings-button">
            <img src={settingsIcon} alt="Settings" className="settings-icon" />
          </button>
          <button className="navbar-button notification-button">
            <img src={bellLogo} alt="Notifications" className="notification-icon" />
          </button>
          <button className="navbar-button organisation-button">Organisation</button>
          <button className="navbar-button help-button">?</button>
          <button className="navbar-button profile-button">👤</button>
          <button className="navbar-button" onClick={handleLogout} title="Log out">Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;