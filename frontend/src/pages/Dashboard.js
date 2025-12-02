import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import activeAlarmImage from "../assets/Active-alarm.png";
import floorPlanImage from "../assets/floor-plan.jpg";
import intrusionIcon from "../assets/intrusion-icon.jpg";
import securityCameraIcon from "../assets/security-camera.jpg";
import "../styles/pages.css";
import { getCachedUser } from "../utils/userStorage";
import { triggerAiAnalysis } from "../utils/api"; // Import the new API function

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
    link: "/2d-floorplan/floorplan",
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

const formatSinceLabel = (dateString) => {
  if (!dateString) return "since your last session";
  const ts = new Date(dateString);
  if (Number.isNaN(ts.getTime())) return "since your last session";

  const now = new Date();
  const diffMs = now - ts;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
};

const buildPlaceholderSummary = (user) => {
  const sinceLabel = formatSinceLabel(user?.last_login);
  return {
    title: "AI Summary",
    short: `Quiet period the last ${sinceLabel}. No critical anomalies flagged. Cameras 1-3 stayed online and motion stayed within normal thresholds.`,
    detail:
      "AI analysis scanned the last session window and found no alarms requiring action. Two minor motion spikes on Camera 2 were auto-dismissed. Ingress patterns stayed within usual volume and no zone boundaries were crossed.",
    sinceLabel,
  };
};

function Dashboard({ isAlarmFiring = false }) {
  const [isAlarmActive, setIsAlarmActive] = useState(Boolean(isAlarmFiring));
  // State for AI Data
  const [aiSummary, setAiSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // New loading state
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  useEffect(() => {
    const fetchAiData = async () => {
      const user = getCachedUser();
      const sinceLabel = formatSinceLabel(user?.last_login);
      
      setIsLoading(true);

      try {
        // 1. Call the Backend API
        const data = await triggerAiAnalysis();
        
        // 2. Format the response for the UI
        // The API now returns { message: "...", cached: true/false, generated_at: "..." }
        const fullText = data.message || "No analysis available.";
        const shortText = fullText.length > 120 
          ? fullText.substring(0, 120) + "..." 
          : fullText;

        // 3. Determine the time label based on whether it's cached
        let timeLabel = sinceLabel;
        if (data.cached && data.generated_at) {
          timeLabel = formatSinceLabel(data.generated_at);
        }

        setAiSummary({
          title: data.cached ? "AI Security Agent" : "AI Security Agent",
          short: shortText,
          detail: fullText,
          sinceLabel: timeLabel,
          isCached: data.cached || false,
        });

      } catch (error) {
        console.error("AI Fetch Failed:", error);
        // Fallback in case of error (e.g. AI container is offline)
        setAiSummary({
          title: "System Status",
          short: "AI Agent is currently offline.",
          detail: "Could not retrieve the latest security analysis. Please check container status.",
          sinceLabel: sinceLabel,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAiData();
  }, []);

  const handleTriggerAlarm = () => setIsAlarmActive(true);
  const handleIgnoreAlarm = () => setIsAlarmActive(false);

  const showAiSummary = useMemo(() => aiSummary && !summaryDismissed, [aiSummary, summaryDismissed]);

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

     
        {/* AI SUMMARY SECTION */}
      <div className="ai-summary-wrapper" style={{ minHeight: '160px' }}>
        {isLoading ? (
          /* Simple Loading State */
          <div className="ai-summary" style={{ opacity: 0.7 }}>
             <div className="ai-summary__content">
                <div className="ai-summary__eyebrow">AI Analysis</div>
                <div className="ai-summary__headline">Analyzing security logs...</div>
                <p className="ai-summary__text">Please wait while the AI agent scans the latest Intrusion logs.</p>
             </div>
          </div>
        ) : showAiSummary ? (
          <div className="ai-summary" role="status" aria-live="polite">
            <div className="ai-summary__content">
              <div className="ai-summary__eyebrow">{aiSummary.title}</div>
              <div className="ai-summary__headline">
                Report generated {aiSummary.sinceLabel}
              </div>
              <p className="ai-summary__text">
                {summaryExpanded ? aiSummary.detail : aiSummary.short}
              </p>
            </div>
            <div className="ai-summary__actions">
              <button
                type="button"
                className="ai-summary__button ai-summary__button--ghost"
                onClick={() => setSummaryExpanded((prev) => !prev)}
              >
                {summaryExpanded ? "Show less" : "See more"}
              </button>
              <button
                type="button"
                className="ai-summary__button ai-summary__button--primary"
                onClick={() => setSummaryDismissed(true)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
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
