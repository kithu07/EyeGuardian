import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ----------------------------
# Load Face Landmarker model
# ----------------------------
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

# ----------------------------
# Open webcam
# ----------------------------
cap = cv2.VideoCapture(0)

# ✅ Make OpenCV window resizable
window_name = "Week 1 – Face Landmarks (Tasks API)"
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 1280, 720)

# ----------------------------
# Webcam loop
# ----------------------------
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

    # Draw landmarks
    if result.face_landmarks:
        for face_landmarks in result.face_landmarks:
            h, w, _ = frame.shape
            for lm in face_landmarks:
                x = int(lm.x * w)
                y = int(lm.y * h)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)

    cv2.imshow(window_name, frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
