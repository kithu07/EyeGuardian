import cv2
import numpy as np

class AmbientLightAnalyzer:
    """
    Computes ambient lighting condition from webcam frames
    """

    def analyze(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)

        if brightness < 60:
            level = "Dim"
            risk = 2
        elif brightness > 180:
            level = "Harsh"
            risk = 2
        else:
            level = "Good"
            risk = 0

        return {
            "brightness": round(float(brightness), 2),
            "level": level,
            "risk": risk
        }
