import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";
import "../styles/recording.css";

const API_URL = "http://localhost:5001";

const VideoFeed = () => {
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
        src={`${API_URL}/video_feed`}
        alt="Live video feed"
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

  const handleToggleRecording = () => {
    const endpoint = isRecording ? "/recording/stop" : "/recording/start";
    fetch(`${API_URL}${endpoint}`, { method: "POST" })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => Promise.reject(err));
        }
        return res.json();
      })
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
    <div className="recording-page">
      <div className="recording-page__container">
        <header className="recording-card recording-card--padded recording-header">
          <div className="recording-header__content">
            <h1 className="recording-header__title">Video Recording Console</h1>
          </div>
          <Link className="recording-header__cta" to="/video-feed/recording-library">
            Go to Recording Library ▶
          </Link>
        </header>

        <section className="recording-card recording-card--padded recording-toolbar">
          <div className="recording-toolbar__group">
            <button
              type="button"
              className={`recording-button ${
                isRecording ? "recording-button--danger" : "recording-button--primary"
              }`}
              onClick={handleToggleRecording}
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

          <div className="recording-toolbar__group recording-toolbar__spacer">
            <button
              type="button"
              className="recording-button recording-button--ghost"
              onClick={() => setModalOpen(true)}
            >
              Open Live Feed Modal
            </button>
            <button
              type="button"
              className="recording-button recording-button--ghost"
              onClick={handleApiTest}
            >
              Test Backend API
            </button>
          </div>

          <div className="recording-status">
            <span>Current status: {statusMessage}</span>
            {statusCheckedAt && (
              <span className="recording-status__timestamp">
                Last updated: {statusCheckedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </section>

        <section className="recording-card recording-card--padded recording-player-card__wrapper">
          <h2 className="recording-section-title">Live Feed</h2>
          <div className="recording-player-card">
            <VideoFeed />
          </div>
        </section>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <img className="recording-modal__image" src={`${API_URL}/video_feed`} alt="Live stream" />
        </Modal>
      </div>
    </div>
  );
}
