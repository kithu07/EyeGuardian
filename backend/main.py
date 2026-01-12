from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import json
import random
from typing import Dict

app = FastAPI()

# Global state to store the latest health data
current_health_state: Dict = {
    "blink_rate": 0,
    "distance_cm": 0,
    "posture_score": 100,
    "ambient_light": 0,
    "overall_strain_index": 0
}

async def generate_health_data():
    """
    Background task to simulate real-time health metrics.
    Updates the global state every 1 second.
    """
    global current_health_state
    while True:
        # Simulate realistic fluctuations
        current_health_state = {
            "blink_rate": random.randint(10, 25),  # Blinks per minute
            "distance_cm": random.randint(30, 70), # Distance from screen
            "posture_score": random.randint(50, 100), # 100 is best
            "ambient_light": random.randint(200, 800), # Lux
            # Strain index calculation simulation (weighted average mock)
            "overall_strain_index": int(
                (
                    (100 - random.randint(50, 100)) * 0.3 + # Posture impact
                    (random.randint(0, 100)) * 0.7        # Random stress
                )
            )
        }
        # Ensure strain index is 0-100
        current_health_state["overall_strain_index"] = max(0, min(100, current_health_state["overall_strain_index"]))
        
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    # Start the data generation task
    asyncio.create_task(generate_health_data())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send the current state
            await websocket.send_text(json.dumps(current_health_state))
            await asyncio.sleep(1) # Send updates every second
    except WebSocketDisconnect:
        print("Client disconnected")
