import cv2
import mediapipe as mp
import numpy as np
import math
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ---------------------------------
# Helper function: Rotation → Angles
# ---------------------------------
def rotation_matrix_to_euler_angles(R):
    sy = math.sqrt(R[0, 0] * R[0, 0] + R[1, 0] * R[1, 0])
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
# Load Face Landmarker Model
# ---------------------------------
base_options = python.BaseOptions(
    model_asset_path="face_landmarker.task"
)

options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    output_face_blendshapes=False,
    output_facial_transformation_matrixes=True,
    num_faces=1
)

landmarker = vision.FaceLandmarker.create_from_options(options)

# ---------------------------------
# Open Webcam
# ---------------------------------
cap = cv2.VideoCapture(0)

window_name = "EyeGuardian – Head Posture (Week 2)"
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 1280, 720)

# ---------------------------------
# Webcam Loop
# ---------------------------------
while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Convert frame to RGB for MediaPipe
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    # Face detection
    result = landmarker.detect(mp_image)

    # -----------------------------
    # Draw Facial Landmarks (Week 1)
    # -----------------------------
    if result.face_landmarks:
        for face_landmarks in result.face_landmarks:
            h, w, _ = frame.shape
            for lm in face_landmarks:
                x = int(lm.x * w)
                y = int(lm.y * h)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)

    # ------------------------------------
    # Head Posture using Transformation Matrix (Week 2)
    # ------------------------------------
    if result.facial_transformation_matrixes:
        matrix = np.array(result.facial_transformation_matrixes[0]).reshape(4, 4)
        rotation_matrix = matrix[:3, :3]

        pitch, yaw, roll = rotation_matrix_to_euler_angles(rotation_matrix)

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

        # Display posture
        cv2.putText(
            frame,
            f"Posture: {posture}",
            (30, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

        # Display angles (for debugging & viva)
        cv2.putText(frame, f"Pitch: {pitch:.1f}", (30, 90),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        cv2.putText(frame, f"Yaw: {yaw:.1f}", (30, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        cv2.putText(frame, f"Roll: {roll:.1f}", (30, 150),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    # Show output
    cv2.imshow(window_name, frame)

    if cv2.waitKey(1) & 0xFF == 27:  # ESC
        break

cap.release()
cv2.destroyAllWindows()
