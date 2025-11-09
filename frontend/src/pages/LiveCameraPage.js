import React, { useState } from "react";
import { Link } from "react-router-dom";
import CameraPlayer from "../components/CameraPlayer.js";
import "../styles/pages.css";
import "../styles/liveCamera.css";

/**
 * Page that displays one or multiple live camera feeds.
 * Shows a header with title and a camera selector
 * "All" shows a grid, otherwise a single camera feed
 */
export default function LiveCameraPage({
  title = "Live Camera Footage",
  cameraFeeds = {
    cam1: "http://localhost:5001/video_feed/1",
    cam2: "http://localhost:5001/video_feed/2",
    cam3: "http://localhost:5001/video_feed/3",
  },
  cameraOptions = [
    { key: "cam1", label: "Camera 1" },
    { key: "cam2", label: "Camera 2" },
    { key: "cam3", label: "Camera 3" },
  ],
  initialSelected = "all",
  controls: controlsProp,
}) {

  // Current selected state
  const [selected, setSelected] = useState(initialSelected);
  const handleResetView = () => setSelected("all");

  const options = cameraOptions.map((option) => ({
    ...option,
    url: cameraFeeds[option.key],
  }));

  const normalizedSelected =
    selected === "all" || options.some((option) => option.key === selected) ? selected : "all";

  const isMultiView = normalizedSelected === "all";
  const active =
    options.find((option) => option.key === normalizedSelected) ||
    options[0];

  const renderedControls =
    controlsProp ??
    (
      <label htmlFor="cameraSelect" className="live-camera-control">
        Camera:
        <select
          id="cameraSelect"
          value={normalizedSelected}
          onChange={(e) => setSelected(e.target.value)}
          className="recording-input live-camera-control__select"
        >
          <option value="all">All Cameras</option>
          {cameraOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <section className="page live-camera-page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">{title}</h1>
          <p className="subtitle">
            Monitor live camera streams, switch between layouts and jump into recordings without leaving the page.
          </p>
        </header>

        <div className="page__controls">
          <button type="button" className="page__control page__control--primary" onClick={handleResetView}>
            Show all feeds
          </button>
          <Link className="page__control" to="/video-feed/recording-library">
            Recording library
          </Link>
        </div>
      </div>

      <div className="page__section live-camera__panel">
        <div className="live-camera__header">
          <div className="live-camera__header-content">
            <h2 className="page__section-title">{isMultiView ? "All cameras" : active?.label}</h2>
            {renderedControls}
          </div>
        </div>

        {isMultiView ? (
          <div className="live-camera__grid">
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelected(option.key)}
                className="live-camera__grid-button"
              >
                <CameraPlayer cam={option} />
              </button>
            ))}
          </div>
        ) : (
          <div className="live-camera__single">
            <CameraPlayer cam={active} />
          </div>
        )}
      </div>
    </section>
  );
}
