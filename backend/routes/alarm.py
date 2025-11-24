# backend/routes/alarm.py
import os
import threading
from urllib.parse import quote

import requests
from flask import Blueprint, jsonify
from requests.auth import HTTPBasicAuth, HTTPDigestAuth

bp = Blueprint("alarm", __name__, url_prefix="/api/alarm")

SPEAKER_IP   = os.getenv("SPEAKER_IP", "192.168.0.102")
SPEAKER_USER = os.getenv("SPEAKER_USER", "")
SPEAKER_PASS = os.getenv("SPEAKER_PASS", "")
SPEAKER_CLIP = os.getenv("SPEAKER_CLIP", "exit.mp3")  # exact clip name shown in UI

# --- alarm loop state ---
_alarm_thread = None
_alarm_stop_event = threading.Event()
_alarm_lock = threading.Lock()


def _candidate_urls(clip: str) -> list[str]:
    ip = SPEAKER_IP
    q = quote(clip)

    bases = [
        f"http://{ip}/axis-cgi/mediaclip.cgi",   # common on Axis speakers
        f"http://{ip}/axis-cgi/playclip.cgi",    # some firmwares
        f"http://{ip}/axis-cgi/audio/clip.cgi",  # others
    ]

    variants = []
    for b in bases:
        variants.append(f"{b}?action=play&name={q}")
        variants.append(f"{b}?action=play&name={q}.mp3")
        variants.append(f"{b}?action=play&clip={q}")
        variants.append(f"{b}?action=play&clip={q}.mp3")
        variants.append(f"{b}?action=play&location=flash:{q}")
        variants.append(f"{b}?action=play&location=flash:{q}.mp3")

    # de-dupe while preserving order
    seen, uniq = set(), []
    for u in variants:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def _stop_urls() -> list[str]:
    ip = SPEAKER_IP
    bases = [
        f"http://{ip}/axis-cgi/mediaclip.cgi",
        f"http://{ip}/axis-cgi/playclip.cgi",
        f"http://{ip}/axis-cgi/audio/clip.cgi",
    ]
    return [f"{b}?action=stop" for b in bases]


def _try_with_auth(url: str, timeout: int = 5):
    """
    Try Digest first (typical on Axis), then Basic.
    Return (response, auth_used).
    """
    auth_used = None
    r = None
    if SPEAKER_USER or SPEAKER_PASS:
        # Digest
        try:
            r = requests.get(url, auth=HTTPDigestAuth(SPEAKER_USER, SPEAKER_PASS), timeout=timeout)
            auth_used = "digest"
            if r.status_code != 401:
                return r, auth_used
        except Exception:
            pass
        # Basic
        try:
            r = requests.get(url, auth=HTTPBasicAuth(SPEAKER_USER, SPEAKER_PASS), timeout=timeout)
            auth_used = "basic"
            return r, auth_used
        except Exception as e:
            raise e
    else:
        # No credentials configured
        r = requests.get(url, timeout=timeout)
        auth_used = "none"
    return r, auth_used


def _do_play_once():
    """
    Core 'play this clip once' logic extracted from play_alarm()
    so we can reuse it from the background loop.
    Returns: (ok: bool, payload: dict, status_code: int)
    """
    # Read + sanitize env
    clip_index = os.getenv("SPEAKER_INDEX", "").strip()
    clip_name  = os.getenv("SPEAKER_CLIP", "exit.mp3").strip()

    # allow overriding audio device/output ids if needed
    dev_id = os.getenv("SPEAKER_AUDIODEVICEID", "0").strip() or "0"
    out_id = os.getenv("SPEAKER_AUDIOOUTPUTID", "0").strip() or "0"

    tried = []

    # 1) If we have the numeric index (from DevTools), try those first.
    if clip_index.isdigit():
        base = f"http://{SPEAKER_IP}/axis-cgi/playclip.cgi"
        index_variants = [
            # with action=play
            f"{base}?action=play&clip={clip_index}&audiodeviceid={dev_id}&audiooutputid={out_id}&volume=100&repeat=1",
            # some firmwares omit action=play
            f"{base}?clip={clip_index}&audiodeviceid={dev_id}&audiooutputid={out_id}&volume=100&repeat=1",
        ]
        for url in index_variants:
            r, auth_used = _try_with_auth(url)
            if r.status_code in (200, 204):
                return True, {"ok": True, "used": url, "auth": auth_used}, 200
            tried.append({"url": url, "status": r.status_code, "auth": auth_used, "body": r.text[:160]})

    # 2) Optional fallbacks by name/location if you still want them
    q = quote(clip_name)
    name_variants = [
        f"http://{SPEAKER_IP}/axis-cgi/playclip.cgi?action=play&location=flash:/{q}&volume=100&repeat=1",
        f"http://{SPEAKER_IP}/axis-cgi/playclip.cgi?action=play&clip={q}&volume=100&repeat=1",
    ]
    for url in name_variants:
        r, auth_used = _try_with_auth(url)
        if r.status_code in (200, 204):
            return True, {"ok": True, "used": url, "auth": auth_used}, 200
        tried.append({"url": url, "status": r.status_code, "auth": auth_used, "body": r.text[:160]})

    return False, {
        "ok": False,
        "tried": tried,
        "hint": "Verify SPEAKER_INDEX from DevTools (Network → playclip.cgi?clip=NN).",
    }, 502


def _alarm_worker(interval_seconds: int = 5):
    """
    Background thread that keeps triggering the alarm
    every `interval_seconds` until _alarm_stop_event is set.
    """
    while not _alarm_stop_event.is_set():
        ok, payload, status = _do_play_once()
        # You might want to log failures here, but we won't raise.
        # Wait for the interval, but allow early exit if stop is requested.
        if _alarm_stop_event.wait(interval_seconds):
            break


@bp.route("/play", methods=["POST"])
def play_alarm():
    """
    One-shot alarm (what you already had). Still useful as a test endpoint.
    """
    ok, payload, status = _do_play_once()
    return jsonify(payload), status


@bp.route("/loop/start", methods=["POST"])
def start_alarm_loop():
    """
    Start a repeating alarm that plays every 5 seconds in the background.
    If already running, we just acknowledge.
    """
    global _alarm_thread

    with _alarm_lock:
        if _alarm_thread and _alarm_thread.is_alive():
            return jsonify({"ok": True, "message": "Alarm loop already running"}), 200

        _alarm_stop_event.clear()
        _alarm_thread = threading.Thread(target=_alarm_worker, args=(5,), daemon=True)
        _alarm_thread.start()

    return jsonify({"ok": True, "message": "Alarm loop started (plays every 5s)"}), 200


@bp.route("/stop", methods=["POST"])
def stop_alarm():
    """
    Stop any running alarm loop *and* send stop commands to the speaker.
    """
    global _alarm_thread

    # 1) Stop background loop, if running
    with _alarm_lock:
        thread = None
        if _alarm_thread and _alarm_thread.is_alive():
            _alarm_stop_event.set()
            thread = _alarm_thread
            _alarm_thread = None

    if thread is not None:
        thread.join(timeout=1.0)

    # 2) Send stop to the device as before
    tried = []
    try:
        for url in _stop_urls():
            r, auth_used = _try_with_auth(url)  # <- use the right helper
            if r.status_code in (200, 204):
                return jsonify({
                    "ok": True,
                    "status": r.status_code,
                    "used": url,
                    "auth": auth_used,
                    "message": "Alarm loop stopped"
                }), 200
            tried.append({
                "url": url,
                "status": r.status_code,
                "auth": auth_used,
                "body": r.text[:150],
            })
        return jsonify({"ok": False, "tried": tried}), 502
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@bp.route("/list", methods=["GET"])
def list_clips():
    ip = SPEAKER_IP
    candidates = [
        f"http://{ip}/axis-cgi/mediaclip.cgi?action=list",
        f"http://{ip}/axis-cgi/playclip.cgi?action=list",
        f"http://{ip}/axis-cgi/audio/clip.cgi?action=list",
    ]
    out = []
    for url in candidates:
        try:
            r, auth_used = _try_with_auth(url)
            out.append({"url": url, "status": r.status_code, "auth": auth_used, "body": r.text[:300]})
            if r.status_code in (200, 204):
                break
        except Exception as e:
            out.append({"url": url, "error": str(e)})
    return jsonify({"results": out})
