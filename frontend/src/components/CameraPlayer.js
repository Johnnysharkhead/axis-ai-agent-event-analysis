import React, { useEffect, useState } from "react";

/**
 * Camera player that shows a single camera feed as a card. 
 * Falls back to a message on error or missing URL.
 */
export default function CameraPlayer({ cam }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [cam?.url]);

  const hasValidUrl = Boolean(cam?.url);
  const shouldShowImage = hasValidUrl && !hasError;

  return (
    <div className="camera-player">
      <div className="camera-player__video">
        {shouldShowImage ? (
          <img
            key={cam?.key}
            className="camera-player__image"
            src={cam?.url}
            alt={`${cam?.label ?? "Camera"} live stream`}
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="camera-player__fallback">
            {hasValidUrl
              ? "Unable to load stream. Please check the camera endpoint."
              : "No camera URL configured."}
          </div>
        )}
      </div>

      <div className="camera-player__label">
        Showing: <strong>{cam?.label ?? "Unknown camera"}</strong>
      </div>
    </div>
  );
}
