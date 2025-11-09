import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import Hls from "hls.js";
import "../styles/pages.css";
import "../styles/recording.css";

const API_URL = "http://localhost:5001";
const PAGE_SIZE = 30;
const HLS_EXTENSION = ".m3u8";

const isHlsRecording = (fileName) =>
  typeof fileName === "string" && fileName.toLowerCase().endsWith(HLS_EXTENSION);

function RecordingLibrary() {
  const [videos, setVideos] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playbackKey, setPlaybackKey] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playMode, setPlayMode] = useState("direct");
  const [videoError, setVideoError] = useState(null);
  const [info, setInfo] = useState(null);
  const [infoState, setInfoState] = useState({ loading: false, error: null });

  const availableModes = useMemo(() => {
    if (!selectedVideo) return [];
    if (isHlsRecording(selectedVideo)) {
      return [{ value: "hls", label: "HLS" }];
    }
    return [
      { value: "direct", label: "Direct file" },
      { value: "stream", label: "MJPEG stream" },
    ];
  }, [selectedVideo]);

  const fetchVideos = useCallback(() => {
    setIsLoadingList(true);
    setListError(null);
    fetch(`${API_URL}/videos`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        console.log(data)
        setVideos(data.recordings);
        if (data.recordings.length && !selectedVideo) {
          const defaultVideo = data.recordings[0];
          setSelectedVideo(defaultVideo);
          setPlaybackKey(Date.now());
          setPlayMode(isHlsRecording(defaultVideo) ? "hls" : "direct");
        }
      })
      .catch((error) => {
        console.error("Error fetching videos:", error);
        setListError("Couldn't load the recordings list. Check the network or backend service.");
      })
      .finally(() => setIsLoadingList(false));
  }, [selectedVideo]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    if (!availableModes.length) {
      return;
    }

    if (!availableModes.some((mode) => mode.value === playMode)) {
      setPlayMode(availableModes[0].value);
      setPlaybackKey(Date.now());
    }
  }, [availableModes, playMode]);

  const filteredVideos = useMemo(() => {
    if (!searchTerm) return videos;
    return videos.filter((fileName) =>
      fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [videos, searchTerm]);

  const visibleVideos = useMemo(
    () => filteredVideos.slice(0, visibleCount),
    [filteredVideos, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm]);

  useEffect(() => {
    if (!selectedVideo) {
      setInfo(null);
      setInfoState({ loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setInfoState({ loading: true, error: null });

    fetch(`${API_URL}/video_info/${selectedVideo}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setInfo(data))
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Failed to fetch video info", error);
        setInfoState({ loading: false, error: "Couldn't fetch details for this recording." });
      })
      .finally(() => {
        setInfoState((prev) => ({ ...prev, loading: false }));
      });

    return () => controller.abort();
  }, [selectedVideo]);

  const handleSelectVideo = useCallback(
    (video) => {
      setSelectedVideo(video);
      setPlaybackKey(Date.now());
      setVideoError(null);

      if (isHlsRecording(video)) {
        setPlayMode("hls");
      } else if (playMode === "hls") {
        setPlayMode("direct");
      }
    },
    [playMode]
  );

  const handleReloadPlayback = useCallback(() => {
    setPlaybackKey(Date.now());
    setVideoError(null);
  }, []);

  const handleChangeMode = useCallback((mode) => {
    setPlayMode(mode);
    setVideoError(null);
    setPlaybackKey(Date.now());
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(filteredVideos.length, count + PAGE_SIZE));
  }, [filteredVideos.length]);

  return (
    <section className="page recording-page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Recording Library</h1>
          <p className="subtitle">
            Browse stored footage, switch between playback formats and inspect recording metadata.
          </p>
        </header>

        <div className="page__controls">
          <Link className="page__control page__control--primary" to="/video-feed/video-recording">
            Open recording console
          </Link>
          <button type="button" className="page__control" onClick={fetchVideos} disabled={isLoadingList}>
            {isLoadingList ? "Refreshing…" : "Refresh library"}
          </button>
        </div>
      </div>

      <div className="page__split page__split--sidebar">
        <VideoListPanel
          isLoading={isLoadingList}
          error={listError}
          videos={visibleVideos}
          total={filteredVideos.length}
          hasMore={visibleVideos.length < filteredVideos.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onRefresh={fetchVideos}
          onLoadMore={handleLoadMore}
          onSelect={handleSelectVideo}
          selectedVideo={selectedVideo}
        />

        <div className="page__stack recording-column">
          <PlaybackToolbar
            playMode={playMode}
            onChangeMode={handleChangeMode}
            onReload={handleReloadPlayback}
            selectedVideo={selectedVideo}
            availableModes={availableModes}
          />

          <div className="page__section recording-player-card__wrapper">
            <PlaybackSurface
              selectedVideo={selectedVideo}
              playMode={playMode}
              playbackKey={playbackKey}
              onError={setVideoError}
            />
            {videoError && <p className="recording-error">{videoError}</p>}
          </div>

          <VideoInfoCard info={info} infoState={infoState} />
        </div>
      </div>
    </section>
  );
}

function VideoListPanel({
  isLoading,
  error,
  videos,
  total,
  hasMore,
  searchTerm,
  onSearchChange,
  onRefresh,
  onLoadMore,
  onSelect,
  selectedVideo,
}) {
  let content;
  if (isLoading) {
    content = <p className="recording-message">Loading recordings...</p>;
  } else if (error) {
    content = <p className="recording-message recording-message--error">{error}</p>;
  } else if (!videos.length) {
    content = <p className="recording-message">No recordings match your filters.</p>;
  } else {
    content = (
      <ul className="recording-sidebar__list">
        {videos.map((fileName) => {
          const lowerName = fileName.toLowerCase();
          const playlistSuffix = `/playlist${HLS_EXTENSION}`;
          const displayName = lowerName.endsWith(playlistSuffix)
            ? fileName.slice(0, -playlistSuffix.length)
            : fileName;

          const buttonClass = [
            "recording-sidebar__button",
            selectedVideo === fileName ? "recording-sidebar__button--active" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={fileName} className="recording-sidebar__item">
              <button type="button" onClick={() => onSelect(fileName)} className={buttonClass}>
                {displayName}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <aside className="page__section recording-sidebar">
      <div className="recording-sidebar__search">
        <input
          type="search"
          placeholder="Search by filename"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="recording-input"
        />
        <button
          type="button"
          className="recording-button recording-button--ghost"
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>

      <div className="recording-sidebar__meta">Total {total} recordings</div>

      <div className="recording-sidebar__scroll">{content}</div>

      {hasMore && (
        <div className="recording-sidebar__footer">
          <button
            type="button"
            className="recording-button recording-button--ghost"
            onClick={onLoadMore}
          >
            Load more
          </button>
        </div>
      )}
    </aside>
  );
}

function PlaybackToolbar({ playMode, onChangeMode, onReload, selectedVideo, availableModes }) {
  return (
    <div className="page__section recording-toolbar">
      <div className="recording-toolbar__group">
        <span className="recording-toolbar__label">Playback mode:</span>
        {availableModes.map(({ value, label }) => (
          <ToggleButton
            key={value}
            active={playMode === value}
            label={label}
            onClick={() => onChangeMode(value)}
          />
        ))}
      </div>

      <div className="recording-toolbar__group recording-toolbar__spacer">
        <button
          type="button"
          className="recording-button recording-button--ghost"
          onClick={onReload}
          disabled={!selectedVideo}
        >
          Reload
        </button>
        <button
          type="button"
          className="recording-button recording-button--ghost"
          onClick={() => selectedVideo && window.open(`${API_URL}/videos/${selectedVideo}`, "_blank")}
          disabled={!selectedVideo}
        >
          Open in new tab
        </button>
      </div>
    </div>
  );
}

function PlaybackSurface({ selectedVideo, playMode, playbackKey, onError }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (playMode !== "hls" || !selectedVideo) {
      return undefined;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      return undefined;
    }

    const source = `${API_URL}/videos/${selectedVideo}?ts=${playbackKey}`;
    const cleanup = () => {
      videoElement.pause();
      videoElement.removeAttribute("src");
      videoElement.load();
    };

    const handleLoadedData = () => onError(null);
    const handleNativeError = () =>
      onError("Couldn't load the HLS playlist. Please verify the backend service.");

    if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      videoElement.src = source;
      videoElement.addEventListener("loadeddata", handleLoadedData);
      videoElement.addEventListener("error", handleNativeError);
      videoElement.play().catch(() => {});
      return () => {
        videoElement.removeEventListener("loadeddata", handleLoadedData);
        videoElement.removeEventListener("error", handleNativeError);
        cleanup();
      };
    }

    if (!Hls.isSupported()) {
      onError("HLS playback isn't supported in this browser.");
      cleanup();
      return undefined;
    }

    const hls = new Hls();
    const handleHlsError = (_, data) => {
      if (data?.fatal) {
        onError("Failed to play the HLS stream. Try refreshing or download the recording.");
      }
    };

    hls.on(Hls.Events.ERROR, handleHlsError);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onError(null);
      videoElement.play().catch(() => {});
    });
    hls.loadSource(source);
    hls.attachMedia(videoElement);

    return () => {
      hls.off(Hls.Events.ERROR, handleHlsError);
      hls.destroy();
      cleanup();
    };
  }, [playMode, selectedVideo, playbackKey, onError]);

  if (!selectedVideo) {
    return (
      <div className="recording-player-card__message">
        Select a recording from the list to begin playback.
      </div>
    );
  }

  if (playMode === "stream") {
    return (
      <div className="recording-player-card">
        <img
          key={`${selectedVideo}-${playbackKey}`}
          className="recording-player-card__media"
          src={`${API_URL}/videos/${selectedVideo}/stream?ts=${playbackKey}`}
          alt={`Recording playback ${selectedVideo}`}
          onError={() =>
            onError("Couldn't load the MJPEG stream. Please check the backend service.")
          }
        />
      </div>
    );
  }

  if (playMode === "hls") {
    return (
      <div className="recording-player-card">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          key={`${selectedVideo}-${playbackKey}`}
          className="recording-player-card__media"
          controls
          playsInline
          preload="auto"
          muted
        />
      </div>
    );
  }

  return (
    <div className="recording-player-card">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        key={`${selectedVideo}-${playbackKey}`}
        className="recording-player-card__media"
        controls
        autoPlay
        playsInline
        preload="metadata"
        muted
        src={`${API_URL}/videos/${selectedVideo}?ts=${playbackKey}`}
        onError={() =>
          onError("The browser couldn't play this file directly. Try the MJPEG stream mode instead.")
        }
        onPlay={() => onError(null)}
      >
        Your browser doesn't support the HTML5 video element.
      </video>
    </div>
  );
}

function VideoInfoCard({ info, infoState }) {
  let content;
  if (infoState.loading) {
    content = <p className="recording-message">Loading recording details...</p>;
  } else if (infoState.error) {
    content = <p className="recording-message recording-message--error">{infoState.error}</p>;
  } else if (info) {
    content = (
      <ul className="recording-info__list">
        <li>Filename: {info.filename}</li>
        {info.file_size && <li>File size: {(info.file_size / (1024 * 1024)).toFixed(2)} MB</li>}
        {info.resolution && <li>Resolution: {info.resolution}</li>}
        {typeof info.duration_seconds === "number" && (
          <li>Duration: {info.duration_seconds.toFixed(1)} seconds</li>
        )}
        {typeof info.fps === "number" && <li>Frame rate: {info.fps.toFixed(1)} FPS</li>}
        {info.format && <li>Format: {info.format.toUpperCase()}</li>}
        {typeof info.segment_count === "number" && <li>Segments: {info.segment_count}</li>}
        {info.playable === false && (
          <li className="recording-message recording-message--error">
            Note: The original file can't play directly. Use the MJPEG stream.
          </li>
        )}
        {info.error && (
          <li className="recording-message recording-message--warning">
            Additional info: {info.error}
          </li>
        )}
      </ul>
    );
  } else {
    content = <p className="recording-message">Select a recording to view additional details.</p>;
  }

  return (
    <section className="page__section recording-info">
      <h3 className="recording-info__title">Recording info</h3>
      {content}
    </section>
  );
}

function ToggleButton({ active, label, onClick }) {
  const buttonClass = ["recording-toggle", active ? "recording-toggle--active" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" onClick={onClick} disabled={active} className={buttonClass}>
      {label}
    </button>
  );
}

VideoListPanel.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  videos: PropTypes.arrayOf(PropTypes.string).isRequired,
  total: PropTypes.number.isRequired,
  hasMore: PropTypes.bool.isRequired,
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  selectedVideo: PropTypes.string,
};

PlaybackToolbar.propTypes = {
  playMode: PropTypes.oneOf(["direct", "stream", "hls"]).isRequired,
  onChangeMode: PropTypes.func.isRequired,
  onReload: PropTypes.func.isRequired,
  selectedVideo: PropTypes.string,
  availableModes: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOf(["direct", "stream", "hls"]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
};

PlaybackSurface.propTypes = {
  selectedVideo: PropTypes.string,
  playMode: PropTypes.oneOf(["direct", "stream", "hls"]).isRequired,
  playbackKey: PropTypes.number.isRequired,
  onError: PropTypes.func.isRequired,
};

VideoInfoCard.propTypes = {
  info: PropTypes.shape({
    filename: PropTypes.string,
    file_size: PropTypes.number,
    resolution: PropTypes.string,
    duration_seconds: PropTypes.number,
    fps: PropTypes.number,
    playable: PropTypes.bool,
    error: PropTypes.string,
    segment_count: PropTypes.number,
    playlist_size: PropTypes.number,
    format: PropTypes.string,
  }),
  infoState: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string,
  }).isRequired,
};

ToggleButton.propTypes = {
  active: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default RecordingLibrary;
