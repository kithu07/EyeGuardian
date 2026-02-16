import cv2
import mediapipe as mp
import numpy as np
import math
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ---------------------------------
# Helper: Rotation Matrix → Euler Angles
# ---------------------------------
def rotation_matrix_to_euler_angles(R):
    sy = math.sqrt(R[0, 0]**2 + R[1, 0]**2)
    singular = sy < 1e-6

    if not singular:
        pitch = math.atan2(R[2, 1], R[2, 2])
        yaw   = math.atan2(-R[2, 0], sy)
        roll  = math.atan2(R[1, 0], R[0, 0])
    else:
        pitch = math.atan2(-R[1, 2], R[1, 1])
        yaw   = math.atan2(-R[2, 0], sy)
        roll  = 0

    return np.degrees([pitch, yaw, roll])


# ---------------------------------
# Face Landmarker Setup
# ---------------------------------
base_options = python.BaseOptions(
    model_asset_path="face_landmarker.task"
)

options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    output_facial_transformation_matrixes=True,
    num_faces=1
)

landmarker = vision.FaceLandmarker.create_from_options(options)

# ---------------------------------
# Camera Setup
# ---------------------------------
cap = cv2.VideoCapture(0)

window_name = "EyeGuardian – Ergonomics Module"
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 1280, 720)

# ---------------------------------
# Distance Calibration & Smoothing
# ---------------------------------
REAL_EYE_DISTANCE_CM = 6.3
FOCAL_LENGTH = 650

distance_cm = 60.0
alpha = 0.8

# ---------------------------------
# Main Loop
# ---------------------------------
while True:
    ret, frame = cap.read()
    if not ret:
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    result = landmarker.detect(mp_image)

    posture = "Good Posture"
    overall_posture = "Upright"
    posture_risk = 0.0
    distance_risk = 0.0
    distance_valid = False  

    # ---------------------------------
    # Facial Landmarks & Distance
    # ---------------------------------
    if result.face_landmarks:
        for face_landmarks in result.face_landmarks:
            h, w, _ = frame.shape

            for lm in face_landmarks:
                x = int(lm.x * w)
                y = int(lm.y * h)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)

            left_eye = face_landmarks[33]
            right_eye = face_landmarks[263]

            x1, y1 = int(left_eye.x * w), int(left_eye.y * h)
            x2, y2 = int(right_eye.x * w), int(right_eye.y * h)

            pixel_eye_distance = math.hypot(x2 - x1, y2 - y1)

            if pixel_eye_distance > 20:
                raw_distance = (REAL_EYE_DISTANCE_CM * FOCAL_LENGTH) / pixel_eye_distance
                distance_cm = alpha * distance_cm + (1 - alpha) * raw_distance
                distance_valid = True

            if distance_cm < 40:
                distance_risk = 1.0
            elif distance_cm <= 75:
                distance_risk = 0.0
            else:
                distance_risk = 0.3

    # ---------------------------------
    # Head Pose Estimation
    # ---------------------------------
    if result.facial_transformation_matrixes:
        matrix = np.array(result.facial_transformation_matrixes[0]).reshape(4, 4)
        rotation_matrix = matrix[:3, :3]

        pitch, yaw, roll = rotation_matrix_to_euler_angles(rotation_matrix)

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

        if abs(pitch) > 15 or abs(yaw) > 20 or abs(roll) > 15:
            posture_risk = 1.0
        elif abs(pitch) > 10 or abs(yaw) > 15 or abs(roll) > 10:
            posture_risk = 0.5

        if distance_valid and pitch > 12 and distance_cm < 50:
            overall_posture = "Leaning Forward"
            posture_risk = max(posture_risk, 0.7)

        cv2.putText(frame, f"Posture: {posture}", (30, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        cv2.putText(frame, f"Overall: {overall_posture}", (30, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)

        cv2.putText(frame, f"Distance: {distance_cm:.1f} cm", (30, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        cv2.putText(frame, f"Posture Risk: {posture_risk}", (30, 160),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        cv2.putText(frame, f"Distance Risk: {distance_risk}", (30, 190),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    cv2.imshow(window_name, frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
