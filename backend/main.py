from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import json
import random
import base64
import time
import os
import sys
from typing import Dict

try:
    import cv2
except ImportError:
    cv2 = None

from engine.eye_processor import EyeGuardianEngine
from engine.posture_analyzer import PostureAnalyzer

# Import light modules from the light/ directory without modifying originals
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
sys.path.insert(0, os.path.join(PROJECT_DIR, "light"))

from ambient_light import AmbientLightAnalyzer
from risk_fusion import RiskFusionEngine

POSTURE_MODEL_PATH = os.path.join(PROJECT_DIR, "posture", "face_landmarker.task")

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    print("EyeGuardian Backend Started")
    print(f"Posture model path: {POSTURE_MODEL_PATH}")
    print(f"Model exists: {os.path.exists(POSTURE_MODEL_PATH)}")

@app.websocket("/ws/health-stream")
async def health_stream_endpoint(websocket: WebSocket):
    await websocket.accept()

    if cv2 is None:
        await websocket.send_json({"error": "OpenCV not installed"})
        await websocket.close()
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        await websocket.send_json({"error": "Could not open camera"})
        await websocket.close()
        return

    # Initialize all engines
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
    else:
        print(f"Warning: Posture model not found at {POSTURE_MODEL_PATH}")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await websocket.send_json({"error": "Failed to read frame"})
                break

            frame = cv2.flip(frame, 1)

            # --- Eye processing (blink, redness, EAR) ---
            try:
                eye_data, annotated_frame = eye_engine.process_frame(frame, return_annotated=True)
            except Exception as e:
                eye_data = {"blinks": 0, "incomplete_blinks": 0, "redness": 0.0, "is_dry": False, "ear": 0.0}
                annotated_frame = frame.copy()

            # --- Posture & distance ---
            if posture_analyzer:
                try:
                    posture_data = posture_analyzer.analyze(frame)
                except Exception as e:
                    print(f"[Posture] Error analyzing frame: {e}")
                    import traceback
                    traceback.print_exc()
                    posture_data = {
                        "head_position": "Error", "overall": "Unknown",
                        "pitch": 0, "yaw": 0, "roll": 0,
                        "posture_risk": 0, "distance_cm": 50,
                        "distance_risk": 0, "posture_score": 100,
                    }
            else:
                posture_data = {
                    "head_position": "N/A", "overall": "N/A",
                    "pitch": 0, "yaw": 0, "roll": 0,
                    "posture_risk": 0, "distance_cm": 50,
                    "distance_risk": 0, "posture_score": 100,
                }

            # --- Ambient light ---
            try:
                light_data = light_analyzer.analyze(frame)
            except Exception:
                light_data = {"brightness": 0, "level": "Unknown", "risk": 0}

            # --- Blink rate (blinks in the last 60 seconds) ---
            now = time.time()
            recent_blinks = sum(1 for t in eye_engine.blink_timestamps if now - t <= 60)

            # --- Redness level ---
            redness = eye_data.get("redness", 0.0)
            if redness > 0.8:
                redness_level = "High"
            elif redness > 0.6:
                redness_level = "Elevated"
            else:
                redness_level = "Normal"

            # --- Risk fusion (uses same logic as light/risk_fusion.py) ---
            blink_risk = 2 if recent_blinks < 10 else (1 if recent_blinks < 15 else 0)
            redness_risk = 2 if redness > 0.8 else (1 if redness > 0.6 else 0)

            risks = {
                "blink": blink_risk,
                "redness": redness_risk,
                "posture": posture_data["posture_risk"] * 2,
                "distance": posture_data["distance_risk"] * 2,
                "lighting": light_data["risk"],
            }
            fusion = risk_engine.compute(risks)
            strain_index = min(100, int(fusion["risk_score"] / 2.0 * 100))

            # --- Encode annotated frame as base64 JPEG ---
            _, buffer = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_b64 = base64.b64encode(buffer).decode("utf-8")

            # --- Build comprehensive payload ---
            payload = {
                "blink_rate": recent_blinks,
                "distance_cm": posture_data["distance_cm"],
                "posture_score": posture_data["posture_score"],
                "ambient_light": round(light_data["brightness"]),
                "overall_strain_index": strain_index,
                "redness": round(redness, 2),
                "camera_frame": f"data:image/jpeg;base64,{frame_b64}",
                "details": {
                    "blink": {
                        "ear": round(eye_data.get("ear", 0), 3),
                        "total_blinks": eye_data.get("blinks", 0),
                        "incomplete_blinks": eye_data.get("incomplete_blinks", 0),
                        "is_dry": eye_data.get("is_dry", False),
                    },
                    "distance": {
                        "value_cm": posture_data["distance_cm"],
                        "risk_score": posture_data["distance_risk"],
                        "status": (
                            "Too Close" if posture_data["distance_risk"] >= 1.0
                            else ("Too Far" if posture_data["distance_risk"] > 0 else "Safe")
                        ),
                    },
                    "light": {
                        "brightness": light_data["brightness"],
                        "level": light_data["level"],
                        "risk": light_data["risk"],
                    },
                    "posture": {
                        "head_position": posture_data["head_position"],
                        "overall": posture_data["overall"],
                        "pitch": posture_data["pitch"],
                        "yaw": posture_data["yaw"],
                        "roll": posture_data["roll"],
                        "risk": posture_data["posture_risk"],
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

            await websocket.send_json(payload)
            await asyncio.sleep(0.066)  # ~15 FPS

    except WebSocketDisconnect:
        print("Client disconnected from health stream")
    except Exception as e:
        print(f"Error in health stream: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cap.release()
        print("Camera released")


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
