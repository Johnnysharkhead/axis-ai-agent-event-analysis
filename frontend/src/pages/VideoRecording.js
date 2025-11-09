import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";
import "../styles/pages.css";
import "../styles/recording.css";

const API_URL = "http://localhost:5001";

const VideoFeed = ({ cameraId = 1 }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  if (imageError) {
    return (
      <div className="recording-feed__fallback">
        <p>❌ Camera feed unavailable</p>
        <p>Check if:</p>
        <ul>
          <li>Backend is running (python3 backend/main.py)</li>
          <li>Camera is connected and accessible</li>
          <li>Network connectivity is working</li>
        </ul>
        <button
          type="button"
          className="recording-button recording-button--secondary"
          onClick={() => window.location.reload()}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="recording-feed">
      {isLoading && <div className="recording-feed__loader">Loading camera feed...</div>}
      <img
        className="recording-feed__image"
        src={`${API_URL}/video_feed/${cameraId}`}
        alt={`Live video feed (Camera ${cameraId})`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
};

export default function VideoRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Checking camera status...");
  const [statusCheckedAt, setStatusCheckedAt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cameraId, setCameraId] = useState(2);

  const fetchRecordingStatus = () => {
    setIsChecking(true);
    fetch(`${API_URL}/recording/status`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setIsRecording(Boolean(data.is_recording));
        setStatusMessage(data.is_recording ? "Recording" : "Idle");
        setStatusCheckedAt(new Date());
      })
      .catch((error) => {
        console.error("Error fetching recording status:", error);
        setStatusMessage("Unable to fetch recording status. Please check the backend.");
      })
      .finally(() => setIsChecking(false));
  };

  useEffect(() => {
    fetchRecordingStatus();
    const statusInterval = setInterval(fetchRecordingStatus, 10000);
    return () => clearInterval(statusInterval);
  }, []);

  const handleToggleRecording = (activeCameraId) => {
    const endpoint = isRecording ? "/recording/stop" : "/recording/start";
    const fetchOpts = isRecording
      ? { method: "POST" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camera_id: activeCameraId }),
        };


    console.log("Start/Stop for camera:", activeCameraId);

    fetch(`${API_URL}${endpoint}`, fetchOpts)
      .then((res) => (res.ok ? res.json() : res.json().then((err) => Promise.reject(err))))
      .then((data) => {
        const message = data.message || "Recording status changed";
        setStatusMessage(message);
        fetchRecordingStatus();
      })
      .catch((error) => {
        console.error("Error toggling recording:", error);
        const errorMsg = error.error || error.message || "Failed to toggle recording";
        setStatusMessage(`Recording failed: ${errorMsg}`);
      });
  };

  const handleApiTest = async () => {
    setStatusMessage("Testing API...");
    try {
      const response = await fetch(`${API_URL}/test`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      setStatusMessage(data.message || "API request succeeded");
    } catch (error) {
      console.error("Error fetching:", error);
      setStatusMessage("API request failed. Please check the backend service.");
    }
  };

  return (
    <section className="page recording-page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Video Recording Console</h1>
          <p className="subtitle">
            Start or stop manual captures, verify camera connectivity and watch the feed in real time.
          </p>
        </header>

        <div className="page__controls">
          <Link className="page__control" to="/video-feed/recording-library">
            Recording library
          </Link>
          <button type="button" className="page__control page__control--primary" onClick={() => setModalOpen(true)}>
            Open live feed modal
          </button>
        </div>
      </div>

      <div className="page__split page__split--sidebar">
        <div className="page__stack recording-column">
          <section className="page__section recording-toolbar">
            <div className="recording-toolbar__group">
              <button
                type="button"
                className={`recording-button ${
                  isRecording ? "recording-button--danger" : "recording-button--primary"
                }`}
                onClick={() => handleToggleRecording(cameraId)}
                disabled={cameraId == null}
              >
                {isRecording ? "Stop Recording" : "Start Recording"}
              </button>
              <button
                type="button"
                className="recording-button recording-button--secondary"
                onClick={fetchRecordingStatus}
                disabled={isChecking}
              >
                {isChecking ? "Refreshing..." : "Refresh Status"}
              </button>
            </div>

            <div className="recording-toolbar__group">
              <label className="recording-toolbar__label" htmlFor="cameraSelect">
                Camera:
              </label>
              <select
                id="cameraSelect"
                className="recording-input"
                value={cameraId}
                onChange={(e) => setCameraId(Number(e.target.value))}
              >
                <option value={1}>Camera 1</option>
                <option value={2}>Camera 2</option>
                <option value={3}>Camera 3</option>
              </select>
            </div>

            <div className="recording-toolbar__group recording-toolbar__spacer">
              <button type="button" className="recording-button recording-button--ghost" onClick={handleApiTest}>
                Test Backend API
              </button>
            </div>
          </section>

          <section className="page__section recording-status-card">
            <div className="recording-status-card__row">
              <span className="recording-status-card__label">Current status</span>
              <strong className="recording-status-card__value">{statusMessage}</strong>
            </div>
            <div className="recording-status-card__row">
              <span className="recording-status-card__label">Active camera</span>
              <strong className="recording-status-card__value recording-status-card__value--camera">
                Camera {cameraId}
              </strong>
            </div>
            {statusCheckedAt && (
              <div className="recording-status-card__row">
                <span className="recording-status-card__label">Last updated</span>
                <strong className="recording-status-card__value">{statusCheckedAt.toLocaleTimeString()}</strong>
              </div>
            )}
          </section>
        </div>

        <section className="page__section recording-player-card__wrapper">
          <h2 className="recording-section-title">Live feed</h2>
          <VideoFeed cameraId={cameraId} />
          <div className="recording-toolbar__group recording-toolbar__group--end">
            <button
              type="button"
              className="recording-button recording-button--ghost"
              onClick={() => setModalOpen(true)}
            >
              View in modal
            </button>
            <button type="button" className="recording-button recording-button--ghost" onClick={handleApiTest}>
              Test Backend API
            </button>
          </div>
        </section>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <img
          className="recording-modal__image"
          src={`${API_URL}/video_feed/${cameraId}`}
          alt={`Live stream (Camera ${cameraId})`}
        />
      </Modal>
    </section>
  );
}
