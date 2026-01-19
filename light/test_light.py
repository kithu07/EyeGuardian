import cv2
from ambient_light import AmbientLightAnalyzer

cap = cv2.VideoCapture(0)
analyzer = AmbientLightAnalyzer()

for _ in range(200):   # runs ~200 frames, then stops
    ret, frame = cap.read()
    if not ret:
        break

    result = analyzer.analyze(frame)
    print(result)

cap.release()
cv2.destroyAllWindows()
