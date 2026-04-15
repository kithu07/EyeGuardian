from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import threading
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import random
import base64
import time
import os
import sys
from typing import Dict
from datetime import date

try:
    import cv2
except ImportError:
    cv2 = None

from engine.eye_processor import EyeGuardianEngine
from engine.posture_analyzer import PostureAnalyzer

# Import light modules from the light/ directory without modifying originals
if getattr(sys, 'frozen', False):
    # Run by pyinstaller
    BUNDLE_DIR = sys._MEIPASS
    BASE_DIR = BUNDLE_DIR
    PROJECT_DIR = BUNDLE_DIR
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_DIR = os.path.dirname(BASE_DIR)

sys.path.insert(0, os.path.join(PROJECT_DIR, "light"))

from ambient_light import AmbientLightAnalyzer
from risk_fusion import RiskFusionEngine
from database import EyeGuardianDB
from engine.ai_insights_manager import AIInsightsManager

POSTURE_MODEL_PATH = os.path.join(PROJECT_DIR, "posture", "face_landmarker.task")


# How often (seconds) to persist a snapshot row – keeps DB lean
SNAPSHOT_INTERVAL = 30

# --- Performance knobs ---
# Keep preview smooth, but throttle heavy analysis
ANALYSIS_INTERVAL_SEC = 5.0  # posture/light/distance cadence
# How often to encode a new preview image (UI will keep showing last frame between encodes)
PREVIEW_ENCODE_FPS_DEFAULT = 10.0
# Reduce preview clarity to cut CPU/network/memory
PREVIEW_JPEG_QUALITY = 55
PREVIEW_WIDTH = 640
PREVIEW_HEIGHT = 360

# Target FPS for the camera read loop (caps CPU usage)
TARGET_FPS = 30.0
# How many consecutive frame-read failures before giving up
MAX_CONSECUTIVE_FAILURES = 30

# ---------------------------------------------------------------------------
# Shared Background Camera Monitor – manages camera and ML engines in one thread
# to prevent event loop blocking and duplicate model initialization
# ---------------------------------------------------------------------------

class GlobalCameraMonitor:
    def __init__(self):
        self.lock = threading.Lock()
        self.refcount = 0
        self.thread = None
        self.running = False
        self.latest_payload = None
        self.session_id = None
        self.user_email = None
        self.error_state = None

    def start(self, db, user_email: str = None):
        with self.lock:
            self.refcount += 1
            if self.refcount == 1:
                self.running = True
                self.error_state = None
                self.latest_payload = None
                self.user_email = user_email
                self.session_id = db.start_session(user_email)
                self.thread = threading.Thread(target=self._run_loop, args=(db,), daemon=True)
                self.thread.start()
            return self.session_id

    def stop(self, db):
        with self.lock:
            self.refcount -= 1
            if self.refcount <= 0:
                self.running = False
                self.refcount = 0
                if self.session_id:
                    try:
                        db.end_session(self.session_id)
                    except Exception as e:
                        print(f"Error ending session: {e}")
                    self.session_id = None

    def get_latest(self):
        return self.latest_payload, self.error_state

    def _run_loop(self, db):
        cap = cv2.VideoCapture(0)
        # Use default camera resolution

        if not cap.isOpened():
            self.error_state = "Could not open camera"
            self.running = False
            return

        eye_engine = EyeGuardianEngine()
        light_analyzer = AmbientLightAnalyzer()
        risk_engine = RiskFusionEngine()

        posture_analyzer = None
        if os.path.exists(POSTURE_MODEL_PATH):
            try:
                posture_analyzer = PostureAnalyzer(POSTURE_MODEL_PATH)
                print("Posture analyzer initialized successfully")
            except Exception as e:
                print(f"Warning: Could not initialize posture analyzer: {e}")

        last_analysis_time = 0.0
        last_preview_time = 0.0
        last_snapshot_time = 0.0
        last_camera_frame_str = None
        consecutive_read_failures = 0

        last_posture_data: Dict = {
            "head_position": "N/A", "overall": "N/A",
            "pitch": 0, "yaw": 0, "roll": 0,
            "posture_risk": 0, "distance_cm": 50,
            "distance_risk": 0, "posture_score": 100,
        }
        last_light_data: Dict = {"brightness": 0, "level": "Unknown", "risk": 0}

        try:
            while self.running:
                loop_start = time.time()

                ret, frame = cap.read()
                if not ret:
                    consecutive_read_failures += 1
                    if consecutive_read_failures > MAX_CONSECUTIVE_FAILURES:
                        self.error_state = "Camera lost after repeated failures"
                        break
                    time.sleep(0.033)
                    continue
                consecutive_read_failures = 0

                frame = cv2.flip(frame, 1)

                try:
                    eye_data, annotated_frame = eye_engine.process_frame(frame, return_annotated=True)
                except Exception as e:
                    eye_data = {"blinks": 0, "incomplete_blinks": 0, "redness": 0.0, "is_dry": False, "ear": 0.0}
                    annotated_frame = frame

                now = time.time()

                if now - last_analysis_time >= ANALYSIS_INTERVAL_SEC:
                    last_analysis_time = now
                    if posture_analyzer:
                        try:
                            last_posture_data = posture_analyzer.analyze(frame)
                        except Exception as e:
                            last_posture_data = {
                                "head_position": "Error", "overall": "Unknown",
                                "pitch": 0, "yaw": 0, "roll": 0, "posture_risk": 0,
                                "distance_cm": 50, "distance_risk": 0, "posture_score": 100,
                            }
                    try:
                        last_light_data = light_analyzer.analyze(frame)
                    except Exception:
                        pass

                recent_blinks = sum(1 for t in eye_engine.blink_timestamps if now - t <= 60)
                redness = eye_data.get("redness", 0.0)
                redness_level = "High" if redness > 0.8 else ("Elevated" if redness > 0.6 else "Normal")

                blink_risk = 2 if recent_blinks < 10 else (1 if recent_blinks < 15 else 0)
                redness_risk = 2 if redness > 0.8 else (1 if redness > 0.6 else 0)

                risks = {
                    "blink": blink_risk,
                    "redness": redness_risk,
                    "posture": last_posture_data["posture_risk"] * 2,
                    "distance": last_posture_data["distance_risk"] * 2,
                    "lighting": last_light_data["risk"],
                }
                fusion = risk_engine.compute(risks)
                strain_index = min(100, int(fusion["risk_score"] / 2.0 * 100))

                # Always encode frame at 10 fps for the shared UI state
                if now - last_preview_time >= (1.0 / 10.0):
                    last_preview_time = now
                    _, buffer = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, PREVIEW_JPEG_QUALITY])
                    frame_b64 = base64.b64encode(buffer).decode("utf-8")
                    last_camera_frame_str = f"data:image/jpeg;base64,{frame_b64}"

                payload = {
                    "blink_rate": recent_blinks,
                    "distance_cm": last_posture_data["distance_cm"],
                    "posture_score": last_posture_data["posture_score"],
                    "ambient_light": round(last_light_data["brightness"]),
                    "overall_strain_index": strain_index,
                    "redness": round(redness, 2),
                    "camera_frame": last_camera_frame_str,
                    "details": {
                        "blink": {
                            "ear": round(eye_data.get("ear", 0), 3),
                            "total_blinks": eye_data.get("blinks", 0),
                            "incomplete_blinks": eye_data.get("incomplete_blinks", 0),
                            "is_dry": eye_data.get("is_dry", False),
                        },
                        "distance": {
                            "value_cm": last_posture_data["distance_cm"],
                            "risk_score": last_posture_data["distance_risk"],
                            "status": "Too Close" if last_posture_data["distance_risk"] >= 1.0 else ("Too Far" if last_posture_data["distance_risk"] > 0 else "Safe"),
                        },
                        "light": {
                            "brightness": last_light_data["brightness"],
                            "level": last_light_data["level"],
                            "risk": last_light_data["risk"],
                        },
                        "posture": {
                            "head_position": last_posture_data["head_position"],
                            "overall": last_posture_data["overall"],
                            "pitch": last_posture_data["pitch"],
                            "yaw": last_posture_data["yaw"],
                            "roll": last_posture_data["roll"],
                            "risk": last_posture_data["posture_risk"],
                        },
                        "redness": {
                            "score": round(redness, 2),
                            "level": redness_level,
                        },
                        "risk_fusion": {
                            "score": fusion["risk_score"],
                            "level": fusion["risk_level"],
                        },
                    },
                }

                self.latest_payload = payload

                now_db = time.time()
                if now_db - last_snapshot_time >= SNAPSHOT_INTERVAL and self.session_id:
                    last_snapshot_time = now_db
                    try:
                        snap_payload = {k: v for k, v in payload.items() if k != "camera_frame"}
                        db.insert_snapshot(self.session_id, snap_payload, self.user_email)

                        if strain_index >= 70:
                            db.insert_alert(self.session_id, "high_strain", "danger", f"Strain index critically high: {strain_index}%", self.user_email)
                        elif strain_index >= 50:
                            db.insert_alert(self.session_id, "elevated_strain", "warning", f"Strain index elevated: {strain_index}%", self.user_email)

                        if eye_data.get("is_dry", False):
                            db.insert_alert(self.session_id, "dry_eyes", "warning", f"Low blink rate ({recent_blinks}/min) – eyes may be dry", self.user_email)

                        if last_posture_data["posture_risk"] >= 1.0:
                            db.insert_alert(self.session_id, "bad_posture", "danger", f"Poor posture detected: {last_posture_data['head_position']}", self.user_email)
                        elif last_posture_data["posture_risk"] >= 0.5:
                            db.insert_alert(self.session_id, "bad_posture", "warning", f"Posture needs attention: {last_posture_data['head_position']}", self.user_email)

                        if last_posture_data["distance_risk"] >= 1.0:
                            db.insert_alert(self.session_id, "too_close", "warning", f"Too close to screen: {last_posture_data['distance_cm']} cm", self.user_email)

                        if last_light_data["risk"] >= 2:
                            db.insert_alert(self.session_id, "bad_lighting", "warning", f"Lighting is {last_light_data['level']} (brightness {last_light_data['brightness']:.0f})", self.user_email)
                    except Exception as db_err:
                        print(f"[DB] Error saving snapshot/alert: {db_err}")

                elapsed = time.time() - loop_start
                sleep_time = max(0.001, (1.0 / TARGET_FPS) - elapsed)
                time.sleep(sleep_time)

        except Exception as e:
            print(f"Error in background camera loop: {e}")
        finally:
            if cap:
                cap.release()
            self.running = False


camera_monitor = GlobalCameraMonitor()

app = FastAPI()
    
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
db = EyeGuardianDB()          # single DB instance shared across requests
insights_manager = AIInsightsManager(
    api_key=os.environ.get("GROQ_API_KEY"),
    cache_path=os.path.join(BASE_DIR, "ai_insights_cache.json"),
    db=db,
    dummy_data_path=os.path.join(BASE_DIR, "data", "dummy_insights_data.json")
)

@app.on_event("startup")
async def startup_event():
    print("EyeGuardian Backend Started")
    print(f"Posture model path: {POSTURE_MODEL_PATH}")
    print(f"Model exists: {os.path.exists(POSTURE_MODEL_PATH)}")
    print(f"Database: {db.db_path}")

@app.on_event("shutdown")
async def shutdown_event():
    db.close()
    print("Database connection closed")

@app.websocket("/ws/health-stream")
async def health_stream_endpoint(websocket: WebSocket):
    await websocket.accept()

    if cv2 is None:
        await websocket.send_json({"error": "OpenCV not installed"})
        await websocket.close()
        return

    include_frame = websocket.query_params.get("include_frame", "1") != "0"
    try:
        send_fps = float(websocket.query_params.get("send_fps", str(PREVIEW_ENCODE_FPS_DEFAULT)))
    except Exception:
        send_fps = PREVIEW_ENCODE_FPS_DEFAULT
    send_fps = max(0.5, min(30.0, send_fps))
    
    # Extract user email from query parameters
    user_email = websocket.query_params.get("user")

    camera_monitor.start(db, user_email)

    try:
        last_sent_time = 0.0
        while True:
            # Check latest payload
            payload, error = camera_monitor.get_latest()
            
            if error:
                await websocket.send_json({"error": error})
                break
                
            now = time.time()
            if payload and (now - last_sent_time) >= (1.0 / send_fps):
                last_sent_time = now
                if not include_frame:
                    payload = payload.copy()
                    payload["camera_frame"] = None
                await websocket.send_json(payload)
                
            await asyncio.sleep(0.05)

    except WebSocketDisconnect:
        print("Client disconnected from health stream")
    except Exception as e:
        print(f"Error in subscriber stream: {e}")
    finally:
        camera_monitor.stop(db)


# Keep /ws for backward compatibility (mock data matching new structure)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            blink_rate = random.randint(10, 25)
            distance = random.randint(30, 70)
            posture_score = random.randint(50, 100)
            brightness = random.randint(40, 220)
            redness = round(random.uniform(0.3, 0.9), 2)
            strain = random.randint(0, 100)

            light_level = "Dim" if brightness < 60 else ("Harsh" if brightness > 180 else "Good")
            redness_level = "High" if redness > 0.8 else ("Elevated" if redness > 0.6 else "Normal")

            payload = {
                "blink_rate": blink_rate,
                "distance_cm": distance,
                "posture_score": posture_score,
                "ambient_light": brightness,
                "overall_strain_index": strain,
                "redness": redness,
                "camera_frame": None,
                "details": {
                    "blink": {
                        "ear": round(random.uniform(0.15, 0.35), 3),
                        "total_blinks": random.randint(20, 200),
                        "incomplete_blinks": random.randint(0, 10),
                        "is_dry": blink_rate < 12,
                    },
                    "distance": {
                        "value_cm": distance,
                        "risk_score": 1.0 if distance < 40 else (0.3 if distance > 75 else 0.0),
                        "status": "Too Close" if distance < 40 else ("Too Far" if distance > 75 else "Safe"),
                    },
                    "light": {
                        "brightness": brightness,
                        "level": light_level,
                        "risk": 2 if (brightness < 60 or brightness > 180) else 0,
                    },
                    "posture": {
                        "head_position": random.choice(["Good Posture", "Head Down", "Head Up", "Looking Right"]),
                        "overall": random.choice(["Upright", "Leaning Forward"]),
                        "pitch": round(random.uniform(-20, 20), 1),
                        "yaw": round(random.uniform(-20, 20), 1),
                        "roll": round(random.uniform(-15, 15), 1),
                        "risk": round(random.uniform(0, 1), 1),
                    },
                    "redness": {
                        "score": redness,
                        "level": redness_level,
                    },
                    "risk_fusion": {
                        "score": round(strain / 50, 2),
                        "level": "Low" if strain < 35 else ("Medium" if strain < 70 else "High"),
                    },
                },
            }

            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client disconnected")

# ---------------------------------------------------------------------------
# REST API – query stored data (for charts, AI analysis, etc.)
# ---------------------------------------------------------------------------

@app.get("/api/sessions")
def api_sessions(limit: int = 20):
    """Return recent monitoring sessions."""
    return db.get_sessions(limit)


@app.get("/api/sessions/{session_id}/snapshots")
def api_session_snapshots(session_id: int, limit: int = 500):
    """Return snapshots for a specific session."""
    return db.get_snapshots(session_id=session_id, limit=limit)


@app.get("/api/sessions/{session_id}/alerts")
def api_session_alerts(session_id: int, limit: int = 100):
    """Return alerts for a specific session."""
    return db.get_alerts(session_id=session_id, limit=limit)


@app.get("/api/snapshots")
def api_snapshots(limit: int = 500):
    """Return recent snapshots across all sessions."""
    return db.get_snapshots(limit=limit)


@app.get("/api/alerts")
def api_alerts(limit: int = 100):
    """Return recent alerts across all sessions."""
    return db.get_alerts(limit=limit)


@app.get("/api/daily-summaries")
def api_daily_summaries(days: int = 30):
    """Return daily summary data for charting."""
    return db.get_daily_summaries(days)


@app.get("/api/daily-summaries/{iso_date}")
def api_daily_summary(iso_date: str):
    """Return summary for a specific date (YYYY-MM-DD)."""
    summary = db.get_daily_summary(iso_date)
    if summary is None:
        return JSONResponse(status_code=404, content={"detail": "No data for this date"})
    return summary


@app.get("/api/weekly-summaries")
def api_weekly_summaries(weeks: int = 12):
    """Return weekly summary data for charting (default: last 12 weeks)."""
    return db.get_weekly_summaries(weeks)


@app.get("/api/weekly-summaries/{year}/{week}")
def api_weekly_summary(year: int, week: int):
    """Return summary for a specific ISO week."""
    summary = db.get_weekly_summary(year, week)
    if summary is None:
        return JSONResponse(status_code=404, content={"detail": "No data for this week"})
    return summary


@app.get("/api/monthly-summaries")
def api_monthly_summaries(months: int = 12):
    """Return monthly summary data for charting (default: last 12 months)."""
    return db.get_monthly_summaries(months)


@app.get("/api/monthly-summaries/{year}/{month}")
def api_monthly_summary(year: int, month: int):
    """Return summary for a specific month."""
    summary = db.get_monthly_summary(year, month)
    if summary is None:
        return JSONResponse(status_code=404, content={"detail": "No data for this month"})
    return summary

@app.get("/api/insights-data")
def api_insights_data(user: str = None):
    """Return the aggregated weekly/monthly stats used by AI insights."""
    return db.get_insights_data(user)

@app.get("/api/ai-insights")
def get_ai_insights(user: str = None):
    """Return cached or newly generated AI insights."""
    return insights_manager.get_insights(user_email=user)

@app.post("/api/ai-insights/refresh")
def refresh_ai_insights(user: str = None):
    """Manually trigger a fresh AI insight generation."""
    return insights_manager.get_insights(user_email=user, force_refresh=True)