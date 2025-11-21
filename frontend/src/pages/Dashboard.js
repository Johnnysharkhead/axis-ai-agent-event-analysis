import React, { useState } from "react";
import { Link } from "react-router-dom";
import activeAlarmImage from "../assets/Active-alarm.png";
import floorPlanImage from "../assets/floor-plan.jpg";
import intrusionIcon from "../assets/intrusion-icon.jpg";
import securityCameraIcon from "../assets/security-camera.jpg";
import "../styles/pages.css";

const dashboardTiles = [
  {
    key: "cameras",
    placeholder: "Live Feed",
    label: "Live Feed",
    image: securityCameraIcon,
    link: "/video-feed/live-feed",
  },
  {
    key: "floormap",
    placeholder: "2D floorplan",
    label: "2D Floorplan",
    image: floorPlanImage,
    link: "/2d-floorplan/configuration",
  },
 // { key: "assistant", placeholder: "Assistant shortcut", label: "Ask Axis Assistant" },
  {
    key: "schedule",
    placeholder: "Intrusion Summary",
    label: "Intrusuion Summary",
    image: intrusionIcon,
    link: "/ai-features/intrusion-summary",
  },
];

function Dashboard({ isAlarmFiring = false }) {
  const [isAlarmActive, setIsAlarmActive] = useState(Boolean(isAlarmFiring));

  const handleTriggerAlarm = () => setIsAlarmActive(true);
  const handleIgnoreAlarm = () => setIsAlarmActive(false);

  return (
    <section className="page">
      <div className="page__top-bar">
        <div className="dashboard__top">
          <header className="header">
            <h1 className="title">Dashboard</h1>
            <p className="subtitle">
            </p>
          </header>

          <div className="dashboard__alarm-panel">
            {isAlarmActive && (
              <Link
                to="/video-feed/live-feed"
                className="dashboard__alarm-indicator"
                role="status"
                aria-live="polite"
              >
                <img
                  src={activeAlarmImage}
                  alt="Active alarm"
                  width="64"
                  height="64"
                  className="dashboard__alarm-indicator-image"
                  loading="lazy"
                />
                <div className="dashboard__alarm-indicator-text">
                  <span className="dashboard__alarm-indicator-label">Active alarm</span>
                </div>
              </Link>
            )}

            {/* <div className="dashboard__alarm-actions">
              {!isAlarmActive && (
                <button
                  type="button"
                  className="dashboard__alarm-button dashboard__alarm-button--trigger"
                  onClick={handleTriggerAlarm}
                >
                  Trigger alarm
                </button>
              )}
              {isAlarmActive && (
                <button
                  type="button"
                  className="dashboard__alarm-button"
                  onClick={handleIgnoreAlarm}
                >
                  Ignore alarm
                </button>
              )}
            </div> */}
          </div>
        </div>
      </div>

      
        <div className="page__placeholder-grid page__placeholder-grid--spaced">
          {dashboardTiles.map(({ key, placeholder, label, image, link }) => {
            const CardWrapper = link ? Link : "div";
            const wrapperProps = link ? { to: link } : {};

            return (
              <CardWrapper
                key={key}
                {...wrapperProps}
                className={`page__placeholder-card page__placeholder-card--uniform${
                  link ? " page__placeholder-card--link" : ""
                }`}
              >
                <div
                  className={`page__placeholder${image ? " page__placeholder--has-media" : ""}`}
                  aria-label={placeholder}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={placeholder}
                      loading="lazy"
                      className="page__placeholder-image"
                    />
                  ) : (
                    placeholder
                  )}
                </div>
                <span className="page__placeholder-label">{label}</span>
              </CardWrapper>
            );
          })}
        </div>
      
    </section>
  );
}

export default Dashboard;
