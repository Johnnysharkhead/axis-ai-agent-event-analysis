/**
 * App.js is the main component.
 * Here we decide what the app shows (pages, layout, etc).
 */

import React from "react";
import "./styles/App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Footer from "./components/Footer";
import Button from "./components/Button";

function App() {
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

  return (
    <div className="App">
      <Navbar />
      <Home />
      <Button onClick={handleClick}>
        Test button
      </Button>
      <Footer />
    </div>
  );
}

export default App;