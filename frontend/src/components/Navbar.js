/**
 * Navbar component (develop style) with Login and Signup buttons.
 */
/**
 * Example of a reusable component (Navbar).
 * Components = small UI building blocks that can be used across multiple pages.
 * AUTHOR: Rasmus, Emil
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Navbar.css";
import logo from "../assets/Axis_logo.png";
import logoWhite from "../assets/axis-logo-white.png";
import settingsIcon from "../assets/settings_icon.png";
import { logoutUser } from "../utils/api";
import { clearCachedUser, userIsAdmin } from "../utils/userStorage";
import { getSavedTheme, setTheme, THEME_EVENT } from "../utils/theme";
import Modal from "./Modal";

function Navbar({ onToggleSidebar, isSidebarOpen }) {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(userIsAdmin());
  const [theme, setThemeState] = useState(getSavedTheme());

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // ignore error; proceed to redirect
    } finally {
      clearCachedUser();
      navigate('/login', { replace: true });
    }
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  useEffect(() => {
    setIsAdmin(userIsAdmin());
  }, []);

  useEffect(() => {
    const handleThemeChange = (event) => {
      const nextTheme = event?.detail || getSavedTheme();
      setThemeState(nextTheme);
    };
    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange);
  }, []);

  const isProfilePage = window.location.pathname.startsWith("/profile");
  return (
    <nav>
      <div className="navbar-container">
        <div className="navbar-left">
          <button
            type="button"
            className="hamburger-menu"
            aria-label={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
            aria-expanded={!!isSidebarOpen}
            onClick={onToggleSidebar}
          >
            ☰
          </button>

          <button type="button" className="navbar-logo-search" onClick={() => navigate("/dashboard")}>
            <div className="navbar-logo">
              <img
                src={theme === "dark" ? logoWhite : logo}
                alt="Axis Analytics"
                className="navbar-logo__image"
              />
            </div>
            <div className="navbar-text">
              <strong>Axis Analytics</strong>
              <div>SaaS Platform</div>
            </div>
          </button>
        </div>

        <div className="navbar-actions">
          {isAdmin && (
            <div className="navbar-dropdowns">
              <div className="dropdown">
                <button type="button" className="dropbtn">
                  Accounts
                </button>
                <div className="dropdown-content">
                  <button type="button">Manage Accounts</button>
                  <button type="button">Account Settings</button>
                </div>
              </div>
            </div>
          )}

          <div className="navbar-divider"></div>

          <button className="navbar-button settings-button" onClick={() => setIsSettingsOpen(true)} title="Settings">
            <img src={settingsIcon} alt="Settings" className="settings-icon" />
          </button>
          <a
            href="https://tddc88-company-3-623776.gitlab-pages.liu.se/"
            className="navbar-button organisation-button"
            target="_blank"
            rel="noreferrer"
          >
            Organisation
          </a>
          <button
            className={`navbar-button profile-button${isProfilePage ? " active" : ""}`}
            onClick={handleProfileClick}
            title="Profile"
          >
            👤
          </button>
          <button className="navbar-button" onClick={handleLogout} title="Log out">Logout</button>
        </div>
      </div>
      <Modal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Interface Settings">
        <div className="navbar-settings">
          <div className="navbar-settings__section">
            <label htmlFor="themeSelect">Theme</label>
            <select
              id="themeSelect"
              className="navbar-settings__input"
              value={theme}
              onChange={(event) => {
                const nextTheme = event.target.value;
                setThemeState(nextTheme);
                setTheme(nextTheme);
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        
          <button type="button" className="navbar-settings__save" onClick={() => setIsSettingsOpen(false)}>
            Save preferences
          </button>
        </div>
      </Modal>
    </nav>
  );
}

export default Navbar;

function getPageLabel(path) {
  if (path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/video-feed/live-camera") || path.startsWith("/video-feed/camera")) return "Live Camera";
  if (path.startsWith("/video-feed/video-recording")) return "Video Recording";
  if (path.startsWith("/video-feed/recording-library")) return "Recording Library";
  if (path.startsWith("/alarms/alarm-history")) return "Alarm History";
  if (path.startsWith("/2d-floorplan/configuration")) return "2D Floorplan · Configuration";
  if (path.startsWith("/2d-floorplan/heatmap")) return "2D Floorplan · Heatmap";
  if (path.startsWith("/2d-floorplan/zones")) return "2D Floorplan · Zones";
  if (path.startsWith("/2d-floorplan/schedule-alarms")) return "2D Floorplan · Schedule Alarms";
  if (path.startsWith("/dashboard") || path.startsWith("/home")) return "Dashboard";
  return "Axis Analytics";
}
