import os
from flask import Blueprint, jsonify, request, send_from_directory

HLS_PLAYLIST_EXTENSION = ".m3u8"
HLS_SEGMENT_EXTENSION  = ".ts"

def normalize_rel_path(recordings_dir: str, root: str, file: str) -> str:
    """Return a POSIX-style relative path from the recordings directory."""
    rel_root = os.path.relpath(root, recordings_dir)
    relative_name = os.path.join(rel_root, file) if rel_root != "." else file
    return relative_name.replace("\\", "/")

def collect_hls_playlists(recordings_dir: str):
    entries = []
    for root, _, files in os.walk(recordings_dir):
        for file in files:
            if not file.endswith(HLS_PLAYLIST_EXTENSION):
                continue

            playlist_path = os.path.join(root, file)
            try:
                file_size = os.path.getsize(playlist_path)
            except OSError:
                continue

            if file_size <= 0:
                continue

            mtime = os.path.getmtime(playlist_path)
            rel_path = _normalize_rel_path(recordings_dir, root, file)
            entries.append((rel_path, mtime))
    return entries


def collect_legacy_recordings(recordings_dir: str):
    entries = []
    for filename in os.listdir(recordings_dir):
        if not filename.endswith((".mp4", ".avi", ".webm")):
            continue

        file_path = os.path.join(recordings_dir, filename)
        try:
            file_size = os.path.getsize(file_path)
        except OSError:
            continue

        if file_size <= 1024:
            print(f"Skipping {filename} - file too small ({file_size} bytes)")
            continue

        mtime = os.path.getmtime(file_path)
        entries.append((filename, mtime))
    return entries


def playlist_size_bytes(playlist_path: str) -> int:
    try:
        return os.path.getsize(playlist_path)
    except OSError:
        return 0


def segment_stats(playlist_dir: str):
    total_size = 0
    segment_count = 0
    try:
        for entry in os.scandir(playlist_dir):
            if entry.is_file() and entry.name.endswith(HLS_SEGMENT_EXTENSION):
                try:
                    total_size += entry.stat().st_size
                    segment_count += 1
                except OSError:
                    continue
    except FileNotFoundError:
        pass
    return segment_count, total_size


def playlist_duration_seconds(playlist_path: str) -> float:
    duration = 0.0
    try:
        with open(playlist_path, "r", encoding="utf-8") as playlist_file:
            for line in playlist_file:
                line = line.strip()
                if not line.startswith("#EXTINF:"):
                    continue
                try:
                    duration += float(line.split(":", 1)[1].split(",", 1)[0])
                except (ValueError, IndexError):
                    continue
    except (OSError, UnicodeDecodeError):
        return 0.0
    return duration


def extract_hls_metadata(video_path: str, filename: str):
    playlist_dir = os.path.dirname(video_path)
    playlist_size = _playlist_size_bytes(video_path)
    segment_count, segments_size = _segment_stats(playlist_dir)
    total_size = playlist_size + segments_size
    duration = _playlist_duration_seconds(video_path)

    return {
        "filename": filename,
        "file_size": total_size,
        "playlist_size": playlist_size,
        "segment_count": segment_count,
        "duration_seconds": duration,
        "playable": True,
        "format": "hls",
    }


def extract_standard_video_metadata(video_path: str, filename: str):
    if cv2 is None:
        return {
            "filename": filename,
            "file_size": os.path.getsize(video_path),
            "error": "OpenCV not available for video analysis",
        }
