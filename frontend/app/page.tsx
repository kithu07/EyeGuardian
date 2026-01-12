"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import RadialGauge from '@/components/RadialGauge';
import StatCard from '@/components/StatCard';
import LogPanel, { Log } from '@/components/LogPanel';
import CameraPlaceholder from '@/components/CameraPlaceholder';
// Removed unused icon imports

// Types
interface HealthState {
  blink_rate: number;
  distance_cm: number;
  posture_score: number;
  ambient_light: number;
  overall_strain_index: number;
}

// Extend Window interface for Electron API
declare global {
  interface Window {
    electronAPI?: {
      sendNotification: (title: string, body: string) => void;
    };
  }
}

export default function Home() {
  // State
  const [healthState, setHealthState] = useState<HealthState>({
    blink_rate: 0,
    distance_cm: 0,
    posture_score: 100,
    ambient_light: 0,
    overall_strain_index: 0
  });

  const [logs, setLogs] = useState<Log[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const logIdCounter = useRef(0);
  const lastNotificationTime = useRef(0);

  // Helpers
  const addLog = useCallback((message: string, type: 'info' | 'warning' | 'danger' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const newLog = { id: logIdCounter.current++, message, time, type };
      const newLogs = [newLog, ...prev];
      if (newLogs.length > 5) newLogs.pop();
      return newLogs;
    });
  }, []);

  const handleHighStrain = useCallback((level: number) => {
    const now = Date.now();
    // Throttle notifications/logs (every 5 seconds)
    if (now - lastNotificationTime.current > 5000) {
      addLog(`High Eye Strain Detected: ${level}/100`, 'danger');

      // Trigger Electron Notification (defensive check)
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.sendNotification('Eye Health Alert', `Strain Level Critical: ${level}. Take a break!`);
      } else {
        console.log("Electron API not active (Browser Mode)");
      }

      lastNotificationTime.current = now;
    }
  }, [addLog]);

  // WebSocket Logic
  useEffect(() => {
    const connectWebSocket = () => {
      const socket = new WebSocket('ws://localhost:8000/ws');
      socketRef.current = socket;

      socket.onopen = () => {
        addLog('System connected to EyeGuardian Core.', 'info');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setHealthState(data);

          // Check for alerts
          if (data.overall_strain_index > 80) {
            handleHighStrain(data.overall_strain_index);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      socket.onclose = () => {
        addLog('Connection lost. Reconnecting...', 'warning');
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [addLog, handleHighStrain]);

  return (
    <main className="h-screen w-screen p-6 grid grid-cols-12 grid-rows-6 gap-6 max-h-screen overflow-hidden bg-background text-foreground">
      {/* Header (Top) */}
      <div className="col-span-12 row-span-1 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent tracking-tighter">
            EYE GUARDIAN <span className="text-slate-600 font-mono text-xs align-top opacity-50">v1.0 BETA</span>
          </h1>
          <p className="text-slate-400 text-sm">Real-time Vision Wellness Monitor</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700/50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs text-slate-300">System Online</span>
          </div>
        </div>
      </div>

      {/* Left Column: Gauge & Stats */}
      <div className="col-span-4 row-span-5 flex flex-col gap-6">
        {/* Main Gauge */}
        <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-2xl p-6 flex items-center justify-center flex-1 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full"></div>
          <RadialGauge value={healthState.overall_strain_index} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Blink Rate" value={healthState.blink_rate} unit="bpm" icon={
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          } />
          <StatCard label="Distance" value={healthState.distance_cm} unit="cm" icon={
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          } />
          <StatCard label="Amb. Light" value={healthState.ambient_light} unit="lx" icon={
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          } />
          <StatCard label="Posture" value={healthState.posture_score} unit="%" icon={
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          } />
        </div>
      </div>

      {/* Right Column: Camera & Logs */}
      <div className="col-span-8 row-span-5 flex flex-col gap-6">
        {/* Camera Preview */}
        <div className="flex-1 min-h-0">
          <CameraPlaceholder className="h-full w-full" />
        </div>

        {/* Log Panel */}
        <div className="h-1/3">
          <LogPanel logs={logs} />
        </div>
      </div>
    </main>
  );
}
