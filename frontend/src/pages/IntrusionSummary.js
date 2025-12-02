import React, { useMemo, useState, useEffect } from "react"; // Added useEffect
import "../styles/pages.css";
import "../styles/eventHistory.css";
import { getCachedUser } from "../utils/userStorage";
import { getAiHistory } from "../utils/api"; // API function to fetch AI history

const formatSinceLabel = (dateString) => {
  if (!dateString) return "since your last session";
  const ts = new Date(dateString);
  if (Number.isNaN(ts.getTime())) return "since your last session";

  const now = new Date();
  const diffMs = now - ts;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const quickRangeOptions = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "All", value: "all" },
];

export default function IntrusionSummary() {
  const user = getCachedUser();
  const sinceLabel = useMemo(() => formatSinceLabel(user?.last_login), [user]);
  
  // --- STATE MANAGEMENT ---
  const [summaries, setSummaries] = useState([]); // Replaces mock data
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState("7days");
  const [searchTerm, setSearchTerm] = useState("");


  // --- HELPER: To Generate a clean title from the long text ---
  const generateSmartHeadline = (text) => {
    if (!text) return "Security Log Entry";
    const lowerText = text.toLowerCase();

    // 1. Check for "Noise" or "Dismissed" events
    if (lowerText.includes("transient") || lowerText.includes("noise") || lowerText.includes("auto-dismissed")) {
      return "⚠️ Low Priority: Transient Noise Detected";
    }

    // 2. Extract Key Details using Regex
    const objectMatch = text.match(/(human|person|vehicle|face)/i);
    const cameraMatch = text.match(/Camera\s+([A-Za-z0-9]+)/i); // Captures "Camera 2" or "Camera B8..."
    const zoneMatch = text.match(/Zone\s+([A-Za-z0-9]+)/i);     // Captures "Zone B"

    let title = "Activity Detected";

    // 3. Construct the Title
    if (objectMatch) {
      // Capitalize first letter (e.g., "Human") for better presentation
      title = `${objectMatch[0].charAt(0).toUpperCase() + objectMatch[0].slice(1)} Detected`;
    }

    if (zoneMatch) {
      title += ` in Zone ${zoneMatch[1]}`;
    }
    
    if (cameraMatch) {
      // Add camera info if space permits, otherwise keep it short
      title += ` • ${cameraMatch[0]}`; 
    }

    return title;
  };


  // --- FETCH DATA ON MOUNT ---
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const data = await getAiHistory();
        
        // Map Backend Data (summary_date, summary_text) to Frontend UI (date, headline, summary)
        const formattedData = data.map((item) => {
          // Create a headline by taking the first few words of the summary
          const text = item.summary_text || "";
          const smartHeadline = generateSmartHeadline(text); // Use the helper function for smart headline
          const generatedHeadline = text.split('.')[0] + "..."; // First sentence as headline

          return {
            date: item.summary_date || item.created_at.split('T')[0],
            //headline: generatedHeadline, // Original simple headline, doesnt say much replaced with smart one below 
            headline: smartHeadline, // uses the smart headline generator
            summary: text
          };
        });

        setSummaries(formattedData);
      } catch (error) {
        console.error("Failed to load history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const resolvedRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    if (selectedRange === "today") {
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    if (selectedRange === "7days") {
      start.setDate(now.getDate() - 7);
      return { from: start, to: now };
    }
    if (selectedRange === "30days") {
      start.setDate(now.getDate() - 30);
      return { from: start, to: now };
    }

    return { from: null, to: null };
  }, [selectedRange]);

  const filteredSummaries = useMemo(() => {
    const fromTs = resolvedRange.from ? resolvedRange.from.getTime() : null;
    const toTs = resolvedRange.to ? resolvedRange.to.getTime() : null;
    const term = searchTerm.trim();

    // Using 'summaries' state instead of mock data
    return summaries
      .filter((item) => {
        const itemTs = new Date(item.date).getTime();
        if (Number.isNaN(itemTs)) return false;
        if (fromTs && itemTs < fromTs) return false;
        if (toTs && itemTs > toTs) return false;

        if (term) {
          const normalized = item.date;
          if (!normalized.includes(term)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [resolvedRange, searchTerm, summaries]); // Added summaries to dependency array

  const handleResetFilters = () => {
    setSelectedRange("7days");
    setSearchTerm("");
  };

  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Intrusion Summary</h1>
          <p className="subtitle">
            Natural-language summary of what the system has observed.
          </p>
        </header>
      </div>

      <div className="page__stack">
        <div className="page__section">
          <div className="event-history__filters event-history__filters--inline">
            <h2 className="event-history__card-title">Filters</h2>
            <div className="event-history__filter-group">
              <span className="event-history__filter-label">Quick range</span>
              <div className="event-history__pill-group">
                {quickRangeOptions.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    className={`event-history__pill${selectedRange === value ? " event-history__pill--active" : ""}`}
                    onClick={() => setSelectedRange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="event-history__reset event-history__reset--spaced" onClick={handleResetFilters}>
              Reset filters
            </button>
          </div>

          <div className="event-history__table-header" style={{ padding: 0 }}>
            <div>
              <h3 className="page__section-title">Daily summaries</h3>
            </div>
            <label htmlFor="summary-search" className="event-history__search">
              <span className="event-history__search-icon" aria-hidden>
                🔍
              </span>
              <input
                id="summary-search"
                type="search"
                placeholder="Search by date (YYYY-MM-DD)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </div>

          <div className="ai-day-list">
            {isLoading ? (
               /* Loading State */
               <p className="recording-message">Loading history from AI Agent...</p>
            ) : filteredSummaries.length > 0 ? (
              filteredSummaries.map((day, index) => (
                <article key={`${day.date}-${index}`} className="ai-day-card">
                  <div className="ai-day-card__head">
                    <div>
                      <div className="ai-summary__eyebrow">{new Date(day.date).toLocaleDateString()}</div>
                      <h4 className="ai-day-card__title">{day.headline}</h4>
                    </div>
                  </div>
                  <p className="ai-day-card__summary">{day.summary}</p>
                </article>
              ))
            ) : (
              <p className="recording-message">No summaries found for this date range.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}