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
  const handleClick = async () => {
    try {
      const response = await fetch(`http://localhost:${5001}/test`, {
        headers: {
          'Content-Type' : 'application/json',
        },
        credentials: "include",
      });
      //const text = await response.text();
      const data = await response.json();
      // console.log(text);
      console.log(data);
    } catch (error) {
      console.error('Error fetching:', error);
    }
  };

  const openCamera = async () => {
    setModalOpen(true);
  }

  return (
    <div className="App">
      <Navbar />
      <Home />
      <Button onClick={handleClick}>
        Test button
      </Button>
      <button onClick={openCamera}>
        Open camera
      </button>
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