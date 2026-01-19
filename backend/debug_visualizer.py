
import cv2
import time
from engine.eye_processor import EyeGuardianEngine

def main():
    print("Launching EyeGuardian Debug Visualizer...")
    
    # Initialize Camera
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    # Initialize Engine
    engine = EyeGuardianEngine()
    
    print("Press 'q' to quit.")
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to read frame.")
                break
            
            # Flip for mirror effect
            frame = cv2.flip(frame, 1)
            
            # Process and get annotated image
            data, annotated_frame = engine.process_frame(frame, return_annotated=True)
            
            # Add text overlay for metrics
            # EAR
            cv2.putText(annotated_frame, f"EAR: {data['ear']:.2f}", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Blink Count
            cv2.putText(annotated_frame, f"Blinks: {data['blinks']}", (10, 60), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

            # Redness
            color_redness = (0, 0, 255) if data['redness'] > 0.6 else (0, 255, 0)
            cv2.putText(annotated_frame, f"Redness: {data['redness']:.2f}", (10, 90), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color_redness, 2)
            
            # Dry Eye Warning
            if data['is_dry']:
                cv2.putText(annotated_frame, "DRY EYE ALERT!", (10, 150), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)

            # Show the window
            cv2.imshow('EyeGuardian Debug View', annotated_frame)
            
            # Break on 'q'
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Camera released.")

if __name__ == "__main__":
    main()
