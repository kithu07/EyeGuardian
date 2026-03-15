# EyeGuardian

A desktop vision wellness app using FastAPI, Next.js, and Electron.

## Prerequisites

- [Python 3.9+](https://www.python.org/downloads/) (Ideally 3.11.13)
- [Node.js 18+](https://nodejs.org/)

## Setup & Running

You need to run the Backend and the Frontend (Electron) simultaneously.

> **Windows users:** if you encounter an error like `'NODE_ENV' is not recognized as an internal or external command`
> when running `npm run electron:dev`, open `frontend/package.json` and ensure the script uses
> `set "NODE_ENV=development"` (the repository already includes the correct form).

### 1. Backend (FastAPI)

Open a terminal in the root directory:

```bash
cd backend
# Create virtual env (optional but recommended)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```
The WebSocket will be active at `ws://localhost:8000/ws`.

### 2. Frontend & Desktop Shell (Next.js + Electron)

Open a **new** terminal in the root directory:

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Run in Development Mode (Hot Reload)
npm run electron:dev
```

This will launch the Electron window displaying the Dashboard.

## Features

- **Real-time Health Data**: Simulated via WebSocket from Python.
- **Strain Gauge**: Visualizes eye strain levels.
- **Native Notifications**: Triggers system alerts when strain > 80.
- **Automatic Break Reminders**: Every 60 minutes with helpful suggestions (works in any app).
- **Background Monitoring**: Continues monitoring and sending notifications even when the app is minimized.
- **Audio Alerts**: System notification sounds + in-app audio when window is active.
- **Dark Mode UI**: Premium aesthetic with glassmorphism.
- **Cross-Platform**: Works on Windows, macOS, and Linux with system startup support.
- **Auto-Startup**: Enable to launch automatically when system boots.

## Background Monitoring & Break Reminders

When you minimize the app or open another application, EyeGuardian **continues to monitor your eye health** and will:

✅ **Send popup notifications with audio** even when the app is minimized  
✅ **Play system notification sounds** (Glass.aiff on macOS, Windows notification sound, freedesktop on Linux)  
✅ **Show break reminders every 60 minutes** - works in ANY app you're using  
✅ **Update the tray icon** showing health status (🟢🟡🔴)  
✅ **Maintain WebSocket connection** to the backend for real-time data  

**Alert Frequency:**
- Maximum 1 alert every **3 minutes** (global throttling)
- Same alert type max once per **4 minutes** (prevents spam)
- Break reminders every **60 minutes** with rotating helpful suggestions

## Auto-Start on System Boot

Enable "Start on System Boot" in Settings:
- EyeGuardian launches automatically when your system restarts
- Opens minimized in system tray
- Continuously monitors your eye health
- Sends notifications even without opening the window

## Structure

- `/backend`: Python FastAPI logic.
- `/frontend`: Next.js + Tailwind + Electron logic.
  - `/electron`: Main process files.
  - `/src`: Next.js components.

