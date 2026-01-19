from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import json
import random
from typing import Dict
try:
    import cv2
except ImportError:
    cv2 = None
from engine.eye_processor import EyeGuardianEngine

app = FastAPI()
    
@app.on_event("startup")
async def startup_event():
    print("EyeGuardian Backend Started")

@app.websocket("/ws/health-stream")
async def health_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Initialize Camera
    # Note: cv2.VideoCapture(0) opens the default camera.
    # On MacOS, this requires permissions.
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        await websocket.send_json({"error": "Could not open camera"})
        await websocket.close()
        return

    engine = EyeGuardianEngine()
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await websocket.send_json({"error": "Failed to read frame"})
                break
            
            # optimize: flip frame
            frame = cv2.flip(frame, 1)
            
            # Process frame
            data = engine.process_frame(frame)
            
            # Every 10 minutes (or periodically), we could send a summary
            # For now, just send real-time data
            # Optionally check if we need to send a summary
            # summary = engine.generate_mini_health_summary()
            # data['summary'] = summary
            
            await websocket.send_json(data)
            
            # Control frame rate (approx 30 FPS)
            await asyncio.sleep(0.033)
            
    except WebSocketDisconnect:
        print("Client disconnected from health stream")
    except Exception as e:
        print(f"Error in health stream: {e}")
    finally:
        cap.release()
        print("Camera released")

# Keep existing /ws for backward compatibility if needed, or update it
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Mock data for non-camera testing
    current_health_state: Dict = {
        "blink_rate": 0, "distance_cm": 50, "posture_score": 100, 
        "ambient_light": 500, "overall_strain_index": 0
    }
    try:
        while True:
            current_health_state = {
                "blink_rate": random.randint(10, 25), 
                "distance_cm": random.randint(30, 70), 
                "posture_score": random.randint(50, 100), 
                "ambient_light": random.randint(200, 800), 
                "overall_strain_index": random.randint(0, 100)
            }
            await websocket.send_text(json.dumps(current_health_state))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client disconnected")
