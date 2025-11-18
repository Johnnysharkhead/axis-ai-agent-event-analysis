"""Helpers for parsing Axis Fusion Tracker payloads and persisting them."""

from __future__ import annotations

import datetime
import math
import os
import re
from contextlib import nullcontext
from typing import Any, Dict, Iterable, List, Optional, Tuple

from domain.models import FusionData, db

FUSION_TOPIC_RE = re.compile(r"^axis/([^/]+)/analytics/fusion(?:/.*)?$", re.IGNORECASE)
FUSION_MIN_SPEED_MPS = float(os.getenv("FUSION_MIN_SPEED_MPS", 0.3))
FUSION_MIN_DISTANCE_M = float(os.getenv("FUSION_MIN_DISTANCE_M", 0.4))

_track_motion_cache: Dict[str, Dict[str, Any]] = {}


def is_fusion_topic(topic: str) -> bool:
    return bool(FUSION_TOPIC_RE.match(topic))


def _app_context(flask_app):
    if flask_app is None:
        return nullcontext()
    return flask_app.app_context()


def _parse_iso8601(value: Optional[str]) -> Optional[datetime.datetime]:
    if not value or not isinstance(value, str):
        return None
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        return datetime.datetime.fromisoformat(candidate)
    except ValueError:
        return None


def _extract_track_id(track: Dict[str, Any]) -> Optional[str]:
    for key in ("track_id", "id", "uuid", "object_id", "uid"):
        candidate = track.get(key)
        if candidate is not None:
            return str(candidate)
    return None


def _latest_observation(track: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    observations = track.get("observations")
    if isinstance(observations, list) and observations:
        obs = observations[-1]
        if isinstance(obs, dict):
            return obs
    return None


def _extract_bbox(track: Dict[str, Any]) -> Dict[str, Optional[float]]:
    obs = _latest_observation(track)
    bbox = (
        track.get("bounding_box")
        or track.get("bbox")
        or track.get("box")
        or track.get("region")
        or track.get("image", {}).get("bounding_box")
        or ((obs or {}).get("bounding_box") if obs else None)
        or {}
    )
    return {
        "top": bbox.get("top"),
        "bottom": bbox.get("bottom"),
        "left": bbox.get("left"),
        "right": bbox.get("right"),
    }


def _bbox_center(bbox: Dict[str, Optional[float]]) -> Optional[Tuple[float, float]]:
    if None in (
        bbox.get("left"),
        bbox.get("right"),
        bbox.get("top"),
        bbox.get("bottom"),
    ):
        return None
    return (
        (bbox["left"] + bbox["right"]) / 2.0,
        (bbox["top"] + bbox["bottom"]) / 2.0,
    )


def _extract_geoposition(track: Dict[str, Any]) -> Dict[str, Optional[float]]:
    obs = _latest_observation(track)
    geo = (
        track.get("geoposition")
        or track.get("position")
        or track.get("geographical_coordinate")
        or track.get("location")
        or (obs.get("geoposition") if isinstance(obs, dict) else None)
        or {}
    )
    return {
        "latitude": geo.get("latitude") or geo.get("lat"),
        "longitude": geo.get("longitude") or geo.get("lon") or geo.get("lng"),
    }


def _extract_colors(
    track: Dict[str, Any], key: str, class_info: Optional[Dict[str, Any]] = None
) -> Optional[List[str]]:
    colors = None
    if class_info:
        colors = class_info.get(f"{key}_clothing_colors")
    if colors is None:
        colors = track.get(f"{key}_clothing_colors") or track.get("clothing", {}).get(
            key
        )
    if isinstance(colors, list):
        return colors
    if isinstance(colors, str):
        return [colors]
    return None


def _extract_class(track: Dict[str, Any]) -> Dict[str, Optional[Any]]:
    cls_entry = None

    if isinstance(track.get("class"), dict):
        cls_entry = track.get("class")
    elif isinstance(track.get("classification"), dict):
        cls_entry = track.get("classification")
    elif isinstance(track.get("classes"), list) and track.get("classes"):
        cls_entry = track["classes"][0]
    elif isinstance(track.get("classes"), dict):
        cls_entry = track.get("classes")

    if not isinstance(cls_entry, dict):
        cls_entry = {}

    return {
        "type": cls_entry.get("type"),
        "score": cls_entry.get("score"),
        "upper_clothing_colors": cls_entry.get("upper_clothing_colors"),
        "lower_clothing_colors": cls_entry.get("lower_clothing_colors"),
    }


def _extract_speed(track: Dict[str, Any]) -> Optional[float]:
    speed = track.get("speed") or track.get("velocity")
    if isinstance(speed, (int, float)):
        return float(speed)
    if isinstance(speed, dict):
        components = [
            speed.get("x"),
            speed.get("y"),
            speed.get("z"),
            speed.get("magnitude"),
        ]
        values = [float(v) for v in components if isinstance(v, (int, float))]
        if values:
            if speed.get("magnitude") is not None:
                return float(speed["magnitude"])
            return sum(v * v for v in values) ** 0.5
    return None


def _extract_tracks(payload: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    """Yield normalized per-track payloads according to Axis fusion schema."""

    def _pluck(candidate: Any) -> Iterable[Dict[str, Any]]:
        if isinstance(candidate, list):
            for item in candidate:
                if isinstance(item, dict):
                    yield item

    def _with_ids(items: Iterable[Dict[str, Any]]):
        valid = []
        for item in items:
            if any(k in item for k in ("track_id", "id", "uuid", "object_id", "uid")):
                valid.append(item)
        return valid

    if not isinstance(payload, dict):
        return []

    for key in ("tracks", "objects", "observations"):
        if key in payload:
            candidates = _with_ids(list(_pluck(payload[key])))
            if candidates:
                return candidates

    message = payload.get("message")
    if isinstance(message, dict):
        for key in ("tracks", "objects", "observations"):
            if key in message:
                candidates = _with_ids(list(_pluck(message[key])))
                if candidates:
                    return candidates

    data = payload.get("data")
    if isinstance(data, dict):
        for key in ("tracks", "objects", "observations"):
            if key in data:
                candidates = _with_ids(list(_pluck(data[key])))
                if candidates:
                    return candidates

    if isinstance(payload, dict) and any(
        key in payload for key in ("track_id", "id", "uuid", "object_id", "uid")
    ):
        return [payload]

    frame = payload.get("frame")
    if isinstance(frame, dict) and isinstance(frame.get("observations"), list):
        candidates = _with_ids(list(_pluck(frame["observations"])))
        if candidates:
            return candidates

    return []


def _extract_snapshot(track: Dict[str, Any]) -> Optional[str]:
    snapshot = track.get("snapshot") or track.get("image")
    if isinstance(snapshot, dict):
        return snapshot.get("data") or snapshot.get("base64")
    if isinstance(snapshot, str):
        return snapshot
    return None


def _haversine_meters(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    if None in (*p1, *p2):
        return 0.0
    lat1, lon1 = map(math.radians, p1)
    lat2, lon2 = map(math.radians, p2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371000 * c


def _record_motion(track_id: str, geo_pos, bbox_center, timestamp):
    _track_motion_cache[track_id] = {
        "geo": geo_pos,
        "bbox": bbox_center,
        "timestamp": timestamp,
    }


def _is_stationary(
    track_id: str, geo_pos, bbox_center, timestamp, speed: Optional[float]
):
    if speed is not None and speed >= FUSION_MIN_SPEED_MPS:
        _record_motion(track_id, geo_pos, bbox_center, timestamp)
        return False

    previous = _track_motion_cache.get(track_id)
    if not previous:
        _record_motion(track_id, geo_pos, bbox_center, timestamp)
        return False

    moved_m = 0.0
    if (
        geo_pos
        and previous.get("geo")
        and None not in (geo_pos.get("latitude"), geo_pos.get("longitude"))
        and None
        not in (
            previous["geo"].get("latitude"),
            previous["geo"].get("longitude"),
        )
    ):
        moved_m = _haversine_meters(
            (geo_pos["latitude"], geo_pos["longitude"]),
            (previous["geo"]["latitude"], previous["geo"]["longitude"]),
        )
    elif bbox_center and previous.get("bbox"):
        moved_m = (
            (bbox_center[0] - previous["bbox"][0]) ** 2
            + (bbox_center[1] - previous["bbox"][1]) ** 2
        ) ** 0.5

    _record_motion(track_id, geo_pos, bbox_center, timestamp)
    return moved_m < FUSION_MIN_DISTANCE_M


def store_fusion_message(topic: str, payload: Any, flask_app=None, log_fn=None):
    log = log_fn or (lambda _msg: None)

    if not isinstance(payload, dict) or not is_fusion_topic(topic):
        return

    match = FUSION_TOPIC_RE.match(topic)
    if not match:
        return
    camera_serial = match.group(1)

    envelope_timestamp = (
        payload.get("timestamp")
        or payload.get("eventTime")
        or payload.get("time")
        or payload.get("message", {}).get("timestamp")
    )
    envelope_dt = _parse_iso8601(envelope_timestamp)

    tracks = list(_extract_tracks(payload))
    if not tracks:
        log(f"[Fusion] No tracks in payload for {topic}")
        return

    saved = 0
    with _app_context(flask_app):
        for track in tracks:
            track_id = _extract_track_id(track)
            if not track_id:
                continue

            bbox = _extract_bbox(track)
            geo = _extract_geoposition(track)
            cls = _extract_class(track)
            speed = _extract_speed(track)
            bbox_center = _bbox_center(bbox)
            obs = _latest_observation(track)
            obs_timestamp = (
                _parse_iso8601(obs.get("timestamp")) if isinstance(obs, dict) else None
            )
            event_dt = (
                _parse_iso8601(track.get("timestamp") or track.get("time"))
                or envelope_dt
                or obs_timestamp
            )
            if event_dt is None:
                event_dt = datetime.datetime.utcnow()

            if _is_stationary(track_id, geo, bbox_center, event_dt, speed):
                log(f"[Fusion] Skipped stationary track {track_id}")
                continue

            record = FusionData(
                camera_serial=camera_serial,
                track_id=track_id,
                confidence=track.get("confidence")
                or track.get("probability")
                or cls.get("score"),
                class_type=cls.get("type"),
                class_score=cls.get("score"),
                upper_clothing_colors=_extract_colors(track, "upper", cls),
                lower_clothing_colors=_extract_colors(track, "lower", cls),
                bounding_box_top=bbox["top"],
                bounding_box_bottom=bbox["bottom"],
                bounding_box_left=bbox["left"],
                bounding_box_right=bbox["right"],
                latitude=geo["latitude"],
                longitude=geo["longitude"],
                start_time=_parse_iso8601(
                    track.get("start_time") or track.get("first_seen")
                ),
                event_timestamp=event_dt,
                observations=track.get("observations") or track.get("history"),
                snapshot_base64=_extract_snapshot(track),
                raw_payload=track,
            )

            try:
                db.session.add(record)
                saved += 1
            except Exception as exc:
                log(f"[Fusion] Failed to stage track {track_id}: {exc}")

        if saved:
            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                log(f"[Fusion] Commit failed ({topic}): {exc}")
                return

        log(f"[Fusion] Stored {saved} tracks from {topic}")
