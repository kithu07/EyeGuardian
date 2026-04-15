#!/bin/bash
echo "Building EyeGuardian Backend with PyInstaller..."

source venv/bin/activate

pyinstaller main.py -n backend_dist \
  --add-data "../light:light" \
  --add-data "../posture:posture" \
  --add-data "./data:data" \
  --add-data ".env:." \
  --hidden-import="uvicorn.logging" \
  --hidden-import="uvicorn.protocols" \
  --hidden-import="uvicorn.protocols.http" \
  --hidden-import="uvicorn.protocols.http.auto" \
  --hidden-import="uvicorn.protocols.websockets" \
  --hidden-import="uvicorn.protocols.websockets.auto" \
  --hidden-import="uvicorn.lifespan" \
  --hidden-import="uvicorn.lifespan.on" \
  --hidden-import="fastapi" \
  --hidden-import="mediapipe" \
  --hidden-import="cv2" \
  --onedir

echo "Done! Executable bundle created at dist/backend_dist"
