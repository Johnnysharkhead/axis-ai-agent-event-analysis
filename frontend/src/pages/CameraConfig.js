import React, { useState } from "react";
import "../styles/pages.css";

function CameraConfig() {
  const [cameraId, setCameraId] = useState(1);
  const [latitude, setLatitude] = useState(58.3977);
  const [longitude, setLongitude] = useState(15.5765);
  const [tilt, setTilt] = useState(-45.0);
  const [heading, setHeading] = useState(0.0);
  const [elevation, setElevation] = useState(0.0);
  const [installationHeight, setInstallationHeight] = useState(3.0);
  const [restart, setRestart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`http://localhost:5001/cameras/${cameraId}/configure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          tilt: parseFloat(tilt),
          heading: parseFloat(heading),
          elevation: parseFloat(elevation),
          installation_height: parseFloat(installationHeight),
          restart: restart,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <header className="header">
        <h1 className="title">Camera Configuration</h1>
        <p className="subtitle">Configure camera geolocation and orientation</p>
      </header>

      <div className="page__section">
        <form onSubmit={handleSubmit} style={{ maxWidth: "600px" }}>
          {/* Camera Selection */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              Camera ID
            </label>
            <select
              value={cameraId}
              onChange={(e) => setCameraId(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            >
              <option value={1}>Camera 1 (192.168.0.97)</option>
              <option value={2}>Camera 2 (192.168.0.98)</option>
              <option value={3}>Camera 3 (192.168.0.96)</option>
            </select>
          </div>

          {/* Geolocation Section */}
          <fieldset style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #ddd", borderRadius: "4px" }}>
            <legend style={{ fontWeight: "bold", padding: "0 0.5rem" }}>Geolocation</legend>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>
          </fieldset>

          {/* Orientation Section */}
          <fieldset style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #ddd", borderRadius: "4px" }}>
            <legend style={{ fontWeight: "bold", padding: "0 0.5rem" }}>Orientation</legend>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>
                Tilt (degrees, -90 to +90)
              </label>
              <input
                type="number"
                step="0.1"
                value={tilt}
                onChange={(e) => setTilt(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <small style={{ color: "#666" }}>0° = horizon, 90° = up, -90° = down</small>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>
                Heading (degrees, 0-360)
              </label>
              <input
                type="number"
                step="0.1"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <small style={{ color: "#666" }}>0° = North, 90° = East, 180° = South, 270° = West</small>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>
                Elevation (meters, optional)
              </label>
              <input
                type="number"
                step="0.1"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <small style={{ color: "#666" }}>Elevation above sea level</small>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>
                Installation Height (meters)
              </label>
              <input
                type="number"
                step="0.1"
                value={installationHeight}
                onChange={(e) => setInstallationHeight(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <small style={{ color: "#666" }}>Height from ground/floor</small>
            </div>
          </fieldset>

          {/* Restart Option */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={restart}
                onChange={(e) => setRestart(e.target.checked)}
                style={{ marginRight: "0.5rem", width: "20px", height: "20px" }}
              />
              <span>Restart camera after configuration</span>
            </label>
            <small style={{ color: "#666", marginLeft: "28px" }}>
              Camera will reboot (takes ~1-2 minutes)
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: loading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Configuring..." : "Configure Camera"}
          </button>
        </form>

        {/* Results Display */}
        {result && (
          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              backgroundColor: result.success ? "#d4edda" : "#f8d7da",
              border: `1px solid ${result.success ? "#c3e6cb" : "#f5c6cb"}`,
              borderRadius: "4px",
              maxWidth: "600px",
            }}
          >
            <h3 style={{ marginTop: 0, color: result.success ? "#155724" : "#721c24" }}>
              {result.success ? "✓ Configuration Successful" : "✗ Configuration Failed"}
            </h3>

            {result.steps && (
              <div>
                {result.steps.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    <strong>{step.step}:</strong>{" "}
                    <span style={{ color: step.success ? "green" : "red" }}>
                      {step.success ? "✓ Success" : "✗ Failed"}
                    </span>
                    {step.step === "geolocation" && step.success && (
                      <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                        Lat: {step.latitude}, Lng: {step.longitude}
                      </div>
                    )}
                    {step.step === "orientation" && step.success && (
                      <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                        Tilt: {step.tilt}°, Heading: {step.heading}°, Height: {step.installation_height}m
                      </div>
                    )}
                    {step.error && (
                      <div style={{ fontSize: "0.9rem", color: "red", marginTop: "0.25rem" }}>
                        Error: {step.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.error && (
              <div style={{ color: "#721c24" }}>
                <strong>Error:</strong> {result.error}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default CameraConfig;
