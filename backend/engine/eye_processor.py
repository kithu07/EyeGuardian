import cv2
import mediapipe as mp
import numpy as np
import time
from collections import deque

class EyeGuardianEngine:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Blink state
        self.blink_count = 0
        self.incomplete_blink_count = 0
        self.is_blinking = False
        self.min_ear_in_blink = 1.0
        
        self.blink_timestamps = deque(maxlen=2000) 
        self.redness_history = deque(maxlen=1000)
        
        self.EAR_THRESHOLD_COMPLETE = 0.15
        self.EAR_THRESHOLD_INCOMPLETE = 0.25 
        self.EAR_THRESHOLD_OPEN = 0.30
        

        self.RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144] 

        self.LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]

    def _calculate_ear(self, landmarks, w, h):
        def dist(p1, p2):
            return np.linalg.norm(np.array(p1) - np.array(p2))

        coords = []
        for lm in landmarks:
            if hasattr(lm, 'x'):
                coords.append((lm.x * w, lm.y * h))
            else:
                coords.append(lm)

        v1 = dist(coords[1], coords[5])
        v2 = dist(coords[2], coords[4])
        h_dist = dist(coords[0], coords[3])
        
        if h_dist == 0:
            return 0.0
            
        return (v1 + v2) / (2.0 * h_dist)

    def _get_eye_redness(self, image, landmarks, indices):
        h, w, _ = image.shape
        
        x_vals = [int(landmarks[i].x * w) for i in indices]
        y_vals = [int(landmarks[i].y * h) for i in indices]
        
        min_x, max_x = min(x_vals), max(x_vals)
        min_y, max_y = min(y_vals), max(y_vals)
        
        pad = 2
        min_x = max(0, min_x - pad)
        max_x = min(w, max_x + pad)
        min_y = max(0, min_y - pad)
        max_y = min(h, max_y + pad)
        
        if max_x <= min_x or max_y <= min_y:
            return 0.0
            
        eye_roi = image[min_y:max_y, min_x:max_x]
        
        if eye_roi.size == 0:
            return 0.0

        b, g, r = cv2.split(eye_roi)

        r_mean = np.mean(r)
        g_mean = np.mean(g)
        b_mean = np.mean(b)
        
        denominator = g_mean + b_mean
        if denominator == 0:
            return 0.0
            
        return r_mean / denominator

    def process_frame(self, image, return_annotated=False):
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_image)
        
        h, w, _ = image.shape
        data = {
            'blinks': self.blink_count,
            'incomplete_blinks': self.incomplete_blink_count,
            'redness': 0.0,
            'is_dry': False,
            'ear': 0.0
        }
        
        annotated_image = image.copy() if return_annotated else None

        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0].landmark
            
            # Draw landmarks if requested
            if return_annotated:
                mp_drawing = mp.solutions.drawing_utils
                mp_drawing_styles = mp.solutions.drawing_styles
                mp_drawing.draw_landmarks(
                    image=annotated_image,
                    landmark_list=results.multi_face_landmarks[0],
                    connections=self.mp_face_mesh.FACEMESH_TESSELATION,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style())
                mp_drawing.draw_landmarks(
                    image=annotated_image,
                    landmark_list=results.multi_face_landmarks[0],
                    connections=self.mp_face_mesh.FACEMESH_CONTOURS,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style())
                mp_drawing.draw_landmarks(
                    image=annotated_image,
                    landmark_list=results.multi_face_landmarks[0],
                    connections=self.mp_face_mesh.FACEMESH_IRISES,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_iris_connections_style())

            # 1. EAR Calculation
            left_lms = [face_landmarks[i] for i in self.LEFT_EYE_INDICES]
            right_lms = [face_landmarks[i] for i in self.RIGHT_EYE_INDICES]
            
            ear_left = self._calculate_ear(left_lms, w, h)
            ear_right = self._calculate_ear(right_lms, w, h)
            avg_ear = (ear_left + ear_right) / 2.0
            data['ear'] = float(avg_ear)
            
            # Blink Logic
            if avg_ear < self.EAR_THRESHOLD_OPEN:
                if not self.is_blinking:
                    self.is_blinking = True
                    self.min_ear_in_blink = avg_ear
                else:
                    self.min_ear_in_blink = min(self.min_ear_in_blink, avg_ear)
            else:
                # Eyes are open
                if self.is_blinking:
                    # Just finished a blink
                    self.is_blinking = False
                    if self.min_ear_in_blink < self.EAR_THRESHOLD_COMPLETE:
                        self.blink_count += 1
                        self.blink_timestamps.append(time.time())
                    elif self.min_ear_in_blink < self.EAR_THRESHOLD_INCOMPLETE:
                        self.incomplete_blink_count += 1
            
            # Update counts in return data
            data['blinks'] = self.blink_count
            data['incomplete_blinks'] = self.incomplete_blink_count
            
            # 2. Redness Detection
            # We average the redness of both eyes
            redness_l = self._get_eye_redness(image, face_landmarks, self.LEFT_EYE_INDICES)
            redness_r = self._get_eye_redness(image, face_landmarks, self.RIGHT_EYE_INDICES)
            avg_redness = (redness_l + redness_r) / 2.0
            
            self.redness_history.append(avg_redness)
            data['redness'] = float(avg_redness)
            
            # 3. Dry Eyes Logic
            # Metric: if blink rate per minute < 12 (standard is ~15-20)
            # Calculate Rate over last 60 seconds
            now = time.time()
            recent_blinks = sum(1 for t in self.blink_timestamps if now - t <= 60)
            # If we don't have enough history (e.g. startup), assume False
            # Or assume dry if 0 blinks in 10 seconds?
            # Let's stick to the 1 minute rate.
            if recent_blinks < 12:
                data['is_dry'] = True
            
        if return_annotated:
             return data, annotated_image
        return data

    def generate_mini_health_summary(self, window_data=None):
        """
        Generates a summary string based on the last 10 minutes of data.
        window_data: Optional list of data points if provided externally, 
                     otherwise uses internal history.
        """
        now = time.time()
        # Analyze last 10 minutes (600 seconds)
        ten_min_ago = now - 600
        
        valid_blinks = [t for t in self.blink_timestamps if t >= ten_min_ago]
        blink_rate_10m = len(valid_blinks) / 10.0 if len(valid_blinks) > 0 else 0
        
        # Average redness over history (assuming history covers roughly relevant time)
        avg_redness = 0.0
        if self.redness_history:
            avg_redness = sum(self.redness_history) / len(self.redness_history)
            
        summary_messages = []
        
        # Blink analysis
        if blink_rate_10m < 10:
            summary_messages.append("Blink rate is critically low. Please blink more often to hydrate your eyes.")
        elif blink_rate_10m < 15:
            summary_messages.append("Blink rate is slightly low.")
        else:
            summary_messages.append("Blink rate is good.")
            
        # Redness analysis (Thresholds need calibration, assuming 0.6 is high for R/(G+B))
        # Normal R/(G+B) is around 0.33 to 0.5. 
        # If Red is 200, G 100, B 100 -> 200/200 = 1.0
        if avg_redness > 0.7:
             summary_messages.append("Detected significant eye redness. Consider resting your eyes.")
             
        if self.incomplete_blink_count > 5: # Arbitrary threshold
             summary_messages.append(f"Noticed {self.incomplete_blink_count} incomplete blinks. Try to close your eyes fully.")
             
        if not summary_messages:
            return "Eyes appear healthy."
            
        return " ".join(summary_messages)

if __name__ == "__main__":
    # Simple test
    print("Initializing Engine...")
    engine = EyeGuardianEngine()
    print("Engine Initialized.")
