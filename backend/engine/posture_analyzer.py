"""
Posture & Distance Analyzer

Wraps the same algorithms from posture/ergonomics_module.py as a reusable class.
Original posture modules are NOT modified.
"""

import cv2
import mediapipe as mp
import numpy as np
import math
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


def _rotation_matrix_to_euler_angles(R):
    """Same helper from posture/ergonomics_module.py"""
    sy = math.sqrt(R[0, 0] ** 2 + R[1, 0] ** 2)
    singular = sy < 1e-6

    if not singular:
        pitch = math.atan2(R[2, 1], R[2, 2])
        yaw = math.atan2(-R[2, 0], sy)
        roll = math.atan2(R[1, 0], R[0, 0])
    else:
        pitch = math.atan2(-R[1, 2], R[1, 1])
        yaw = math.atan2(-R[2, 0], sy)
        roll = 0

    return np.degrees([pitch, yaw, roll])


class PostureAnalyzer:
    """Analyzes head posture and screen distance from a single frame."""

    def __init__(self, model_path: str):
        # MediaPipe Tasks API on some versions prepends its package path
        # to the model_asset_path. To avoid this, read the model as bytes.
        with open(model_path, "rb") as f:
            model_data = f.read()
        
        base_options = mp_python.BaseOptions(model_asset_buffer=model_data)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_facial_transformation_matrixes=True,
            num_faces=1,
        )
        self.landmarker = vision.FaceLandmarker.create_from_options(options)

        # Distance calibration (same constants as ergonomics_module.py)
        self.REAL_EYE_DISTANCE_CM = 6.3
        self.FOCAL_LENGTH = 650
        self.distance_cm = 60.0
        self.alpha = 0.5  # smoothing factor (lower = more responsive)

    def analyze(self, frame):
        """Analyze a single BGR frame and return posture + distance data."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        
        try:
            result = self.landmarker.detect(mp_image)
        except Exception as e:
            print(f"[PostureAnalyzer] Detection error: {e}")
            return {
                "head_position": "Detection Error",
                "overall": "Unknown",
                "pitch": 0.0, "yaw": 0.0, "roll": 0.0,
                "posture_risk": 0.0,
                "distance_cm": round(self.distance_cm, 1),
                "distance_risk": 0.0,
                "posture_score": 100,
            }

        data = {
            "head_position": "No Face",
            "overall": "Unknown",
            "pitch": 0.0,
            "yaw": 0.0,
            "roll": 0.0,
            "posture_risk": 0.0,
            "distance_cm": round(self.distance_cm, 1),
            "distance_risk": 0.0,
            "posture_score": 100,
        }

        distance_valid = False

        # --- Face landmarks -> screen distance ---
        if result.face_landmarks:
            face_landmarks = result.face_landmarks[0]
            h, w, _ = frame.shape

            left_eye = face_landmarks[33]
            right_eye = face_landmarks[263]
            x1, y1 = int(left_eye.x * w), int(left_eye.y * h)
            x2, y2 = int(right_eye.x * w), int(right_eye.y * h)
            pixel_eye_distance = math.hypot(x2 - x1, y2 - y1)

            if pixel_eye_distance > 20:
                raw_distance = (self.REAL_EYE_DISTANCE_CM * self.FOCAL_LENGTH) / pixel_eye_distance
                self.distance_cm = self.alpha * self.distance_cm + (1 - self.alpha) * raw_distance
                distance_valid = True

            data["distance_cm"] = round(self.distance_cm, 1)

            if self.distance_cm < 40:
                data["distance_risk"] = 1.0
            elif self.distance_cm <= 75:
                data["distance_risk"] = 0.0
            else:
                data["distance_risk"] = 0.3

        # --- Head pose estimation ---
        if result.facial_transformation_matrixes:
            matrix = np.array(result.facial_transformation_matrixes[0]).reshape(4, 4)
            rotation_matrix = matrix[:3, :3]
            pitch, yaw, roll = _rotation_matrix_to_euler_angles(rotation_matrix)

            data["pitch"] = round(float(pitch), 1)
            data["yaw"] = round(float(yaw), 1)
            data["roll"] = round(float(roll), 1)

            posture = "Good Posture"
            if pitch > 10:
                posture = "Head Down"
            elif pitch < -10:
                posture = "Head Up"
            elif yaw > 15:
                posture = "Looking Right"
            elif yaw < -15:
                posture = "Looking Left"
            elif roll > 10:
                posture = "Tilted Right"
            elif roll < -10:
                posture = "Tilted Left"

            data["head_position"] = posture

            posture_risk = 0.0
            if abs(pitch) > 15 or abs(yaw) > 20 or abs(roll) > 15:
                posture_risk = 1.0
            elif abs(pitch) > 10 or abs(yaw) > 15 or abs(roll) > 10:
                posture_risk = 0.5

            overall_posture = "Upright"
            if distance_valid and pitch > 12 and self.distance_cm < 50:
                overall_posture = "Leaning Forward"
                posture_risk = max(posture_risk, 0.7)

            data["overall"] = overall_posture
            data["posture_risk"] = posture_risk

            # Compute posture_score (0-100) based on actual angles
            # Perfect posture = 100, deductions based on how far off-center
            pitch_penalty = min(abs(float(pitch)) / 30.0, 1.0) * 40   # max -40 pts for pitch
            yaw_penalty = min(abs(float(yaw)) / 30.0, 1.0) * 30       # max -30 pts for yaw
            roll_penalty = min(abs(float(roll)) / 25.0, 1.0) * 20     # max -20 pts for roll
            distance_penalty = 0
            if distance_valid:
                if self.distance_cm < 40:
                    distance_penalty = 10
                elif self.distance_cm > 75:
                    distance_penalty = 5

            score = max(0, int(100 - pitch_penalty - yaw_penalty - roll_penalty - distance_penalty))
            data["posture_score"] = score

        return data
