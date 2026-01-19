# EyeGuardian

A desktop vision wellness app using FastAPI, Next.js, and Electron.

## Prerequisites

- [Python 3.9+](https://www.python.org/downloads/) (Ideally 3.11.13)
- [Node.js 18+](https://nodejs.org/)

## Setup & Running

You need to run the Backend and the Frontend (Electron) simultaneously.

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
- **Dark Mode UI**: Premium aesthetic with glassmorphism.

## Structure

- `/backend`: Python FastAPI logic.
- `/frontend`: Next.js + Tailwind + Electron logic.
  - `/electron`: Main process files.
  - `/src`: Next.js components.

