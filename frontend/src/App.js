/**
 * App.js is the main component.
 * Here we decide what the app shows (pages, layout, etc).
 */

import React, { useState } from "react";
import "./styles/App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Footer from "./components/Footer";
import Button from "./components/Button";
import Modal from "./components/Modal";

function App() {
  const [modalOpen, setModalOpen] = useState(false);

  // Base button to try a standard api fetch.
  const handleClick = async () => {
    try {
      const response = await fetch(`http://localhost:${5001}/test`, {
        headers: {
          'Content-Type' : 'application/json',
        },
        credentials: "include",
      });
      const data = await response.json();
    } catch (error) {
      console.error('Error fetching:', error);
    }
  };

  // 
  const openCamera = async () => {
    setModalOpen(true);
  }

  return (
    <div className="App">
      <Navbar />
      <Home />
      <div
        style={{
          display: "flex",
          gap: "16px",
          justifyContent: "center",
          margin: "24px 0",
        }}
      >
        <button
          onClick={handleClick}
          style={{
            padding: "16px 32px",
            background: "#fff",
            border: "2px solid #1976d2",
            color: "#000",
            fontSize: "1.1rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          API Test button
        </button>

        <button
          onClick={openCamera}
          style={{
            padding: "16px 32px",
            background: "#fff",
            border: "2px solid #1976d2",
            color: "#000",
            fontSize: "1.1rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Open camera
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <img
          src={`http://localhost:${5001}/video_feed`}
          alt="Live stream"
          style={{ width: "100%", maxWidth: 600 }}
        />
      </Modal>
      <Footer />
    </div>
  );
}

export default App;