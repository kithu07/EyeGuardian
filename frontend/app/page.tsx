"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import RadialGauge from '@/components/RadialGauge';
import StatCard from '@/components/StatCard';
import LogPanel, { Log } from '@/components/LogPanel';
import CameraPlaceholder from '@/components/CameraPlaceholder';
import AIInsights from '@/components/AIInsights';
import ProgressCharts from '@/components/ProgressCharts';

// new components & helpers for modals and alerts
import BreakReminderModal from '@/components/BreakReminderModal';
import StrainAlertModal from '@/components/StrainAlertModal';
import { evaluateHealthState, HealthFailure } from '@/utils/healthMetricsMonitor';
import { getRecommendations } from '@/utils/breakRecommendations';
import {
  alertHighStrain,
  alertBreakReminder,
  sendAppLog,
} from '@/utils/notificationService';

// Detail sub-types
interface BlinkDetails {
  ear: number;
  total_blinks: number;
  incomplete_blinks: number;
  is_dry: boolean;
}

interface DistanceDetails {
  value_cm: number;
  risk_score: number;
  status: string;
}

interface LightDetails {
  brightness: number;
  level: string;
  risk: number;
}

interface PostureDetails {
  head_position: string;
  overall: string;
  pitch: number;
  yaw: number;
  roll: number;
  risk: number;
}

interface RednessDetails {
  score: number;
  level: string;
}

interface RiskFusionDetails {
  score: number;
  level: string;
}

interface HealthDetails {
  blink: BlinkDetails;
  distance: DistanceDetails;
  light: LightDetails;
  posture: PostureDetails;
  redness: RednessDetails;
  risk_fusion: RiskFusionDetails;
}

// Types
interface HealthState {
  blink_rate: number;
  distance_cm: number;
  posture_score: number;
  ambient_light: number;
  overall_strain_index: number;
  redness: number;
  camera_frame: string | null;
  details: HealthDetails | null;
}

// Electron API types are declared in ../types/electron.d.ts

export default function Home() {
  const [healthState, setHealthState] = useState<HealthState>({
    blink_rate: 0,
    distance_cm: 0,
    posture_score: 100,
    ambient_light: 0,
    overall_strain_index: 0,
    redness: 0,
    camera_frame: null,
    details: null,
  });

  const [logs, setLogs] = useState<Log[]>([]);

  // alert / break modal states
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [breakReasons, setBreakReasons] = useState<string[]>([]);
  const [breakRecs, setBreakRecs] = useState<string[]>([]);
  const [showStrainAlert, setShowStrainAlert] = useState(false);
  const [criticalStrainLevel, setCriticalStrainLevel] = useState(0);

  // session tracking
  const sessionStart = useRef<number>(Date.now());
  const nextReminder = useRef<number>(sessionStart.current + 60 * 60 * 1000); // 1h later
  const remindLaterTimeout = useRef<number | null>(null);
  const lastUserAction = useRef<number>(0); // time of last user acknowledgement/postpone
  const showBreakReminderRef = useRef<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const logIdCounter = useRef(0);
  const lastNotificationTime = useRef(0);
  const FAILURE_SUPPRESSION_MS = 5 * 60 * 1000; // don't re-trigger for failures within 5 minutes

  // track whether we've received a real data packet
  const gotData = useRef(false);
  const appVisibleRef = useRef(true);
  const lastMetricsUpdateMs = useRef(0);
  const METRICS_UPDATE_INTERVAL_MS = 500; // 2 FPS for stable UI (camera can still refresh faster)

  // Helpers
  const addLog = useCallback((message: string, type: 'info' | 'warning' | 'danger' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const newLog = { id: logIdCounter.current++, message, time, type };
      const newLogs = [newLog, ...prev];
      if (newLogs.length > 5) newLogs.pop();
      return newLogs;
    });
    sendAppLog(message, type, (m, t) => { /* duplicate to logs already */ });
  }, []);

  const handleHighStrain = useCallback((level: number) => {
    const now = Date.now();
    // Throttle notifications/logs (every 5 seconds)
    if (now - lastNotificationTime.current > 5000) {
      addLog(`High Eye Strain Detected: ${level}/100`, 'danger');
      alertHighStrain(level);
      setCriticalStrainLevel(level);
      setShowStrainAlert(true);
      lastUserAction.current = now;
      lastNotificationTime.current = now;
    }
  }, [addLog]);

  // WebSocket Logic
  useEffect(() => {
    // keep ref in sync with state so websocket handler sees latest
    showBreakReminderRef.current = showBreakReminder;
  }, [showBreakReminder]);

  useEffect(() => {
    const connectWebSocket = () => {
      if (!appVisibleRef.current) return;
      const socket = new WebSocket('ws://localhost:8000/ws/health-stream?include_frame=1&send_fps=10');
      socketRef.current = socket;

      socket.onopen = () => {
        addLog('System connected to EyeGuardian Core.', 'info');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const nowMs = Date.now();

          // Always keep the last non-null camera frame to avoid flicker
          setHealthState(prev => ({
            ...prev,
            camera_frame: data.camera_frame ?? prev.camera_frame,
          }));

          // Throttle metric updates so cards/gauge don't constantly re-animate/flicker
          if (nowMs - lastMetricsUpdateMs.current >= METRICS_UPDATE_INTERVAL_MS) {
            lastMetricsUpdateMs.current = nowMs;
            setHealthState(prev => ({
              ...prev,
              blink_rate: typeof data.blink_rate === 'number' ? data.blink_rate : prev.blink_rate,
              distance_cm: typeof data.distance_cm === 'number' ? data.distance_cm : prev.distance_cm,
              posture_score: typeof data.posture_score === 'number' ? data.posture_score : prev.posture_score,
              ambient_light: typeof data.ambient_light === 'number' ? data.ambient_light : prev.ambient_light,
              overall_strain_index: typeof data.overall_strain_index === 'number' ? data.overall_strain_index : prev.overall_strain_index,
              redness: typeof data.redness === 'number' ? data.redness : prev.redness,
              details: data.details ?? prev.details,
            }));
          }

          // ignore the very first message if it's placeholder/initial state
          if (!gotData.current) {
            gotData.current = true;
          }

          // run diagnostics on every update only after first real data
          // also enforce a short startup delay so alerts don't fire immediately
          const now = nowMs;
          const startupDelayPassed = now - sessionStart.current >= 60 * 1000; // 1 minute
          if (gotData.current && startupDelayPassed) {
            const failures = evaluateHealthState(data);

            // critical strain check (modal handled in handleHighStrain)
            if (data.overall_strain_index > 80) {
              handleHighStrain(data.overall_strain_index);
            }

            // determine if break reminder should be shown
            const timeExceeded = now >= nextReminder.current;
            const recentUser = now - lastUserAction.current < FAILURE_SUPPRESSION_MS;

            // Only show for failures if user hasn't recently dismissed/acknowledged
            const shouldShowForFailure = failures.length > 0 && !recentUser;

            if ((timeExceeded || shouldShowForFailure) && !showBreakReminderRef.current) {
              // generate reasons and recommendations
              const reasons = failures.map(f => f.message);
              const recs = getRecommendations(failures);
              setBreakReasons(reasons);
              setBreakRecs(recs);
              setShowBreakReminder(true);
              showBreakReminderRef.current = true;
              // throttle native notifications
              if (now - lastNotificationTime.current > 5000) {
                alertBreakReminder();
                lastNotificationTime.current = now;
              }
            }
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      socket.onclose = () => {
        // If app is hidden, we intentionally keep it disconnected to save resources
        if (!appVisibleRef.current) return;
        addLog('Connection lost. Reconnecting...', 'warning');
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    // In Electron: pause UI updates (and camera feed) when the window is hidden.
    // Background monitoring/notifications continue via Electron main process.
    if (typeof window !== 'undefined' && window.electronAPI?.onAppVisibilityChange) {
      window.electronAPI.onAppVisibilityChange((isVisible: boolean) => {
        appVisibleRef.current = isVisible;
        if (!isVisible) {
          if (socketRef.current) {
            try { socketRef.current.close(); } catch { /* ignore */ }
            socketRef.current = null;
          }
          return;
        }
        // visible again => reconnect
        connectWebSocket();
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [addLog, handleHighStrain]);

  // --- modal action handlers ---
  const handleStartBreak = useCallback(() => {
    addLog('User started break', 'info');
    setShowBreakReminder(false);
    // set next reminder hour ahead
    nextReminder.current = Date.now() + 60 * 60 * 1000;
    // clear any pending remind-later timeout
    if (remindLaterTimeout.current) {
      clearTimeout(remindLaterTimeout.current);
      remindLaterTimeout.current = null;
    }
    lastUserAction.current = Date.now();
    showBreakReminderRef.current = false;
  }, [addLog]);

  const handleRemindLater = useCallback(() => {
    addLog('Break reminder postponed', 'warning');
    setShowBreakReminder(false);
    // postpone next reminder by 10 minutes
    nextReminder.current = Date.now() + 10 * 60 * 1000;
    // clear any existing timeout
    if (remindLaterTimeout.current) {
      clearTimeout(remindLaterTimeout.current);
      remindLaterTimeout.current = null;
    }
    lastUserAction.current = Date.now();
    showBreakReminderRef.current = false;
  }, [addLog]);

  const handleStrainConfirm = useCallback(() => {
    addLog('Strain alert acknowledged', 'info');
    setShowStrainAlert(false);
    // also treat as break start for timer
    nextReminder.current = Date.now() + 60 * 60 * 1000;
    lastUserAction.current = Date.now();
    showBreakReminderRef.current = false;
  }, [addLog]);

  const d = healthState.details;

  return (
    <main className="h-screen w-screen p-6 bg-background text-foreground overflow-y-auto">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header (Top) */}
        <div className="flex items-center justify-between">
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Gauge & Stats */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* Main Gauge */}
            <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-2xl p-6 flex items-center justify-center flex-shrink-0 shadow-2xl relative overflow-hidden" style={{ minHeight: '260px' }}>
              <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full"></div>
              <RadialGauge value={healthState.overall_strain_index} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 flex-shrink-0">
              <StatCard label="Blink Rate" value={healthState.blink_rate} unit="bpm"
                details={d ? [
                  { label: "EAR", value: d.blink.ear },
                  { label: "Total Blinks", value: d.blink.total_blinks },
                  { label: "Incomplete", value: d.blink.incomplete_blinks },
                  { label: "Dry Eyes", value: d.blink.is_dry },
                  { label: "Redness", value: d.redness.score },
                  { label: "Redness Level", value: d.redness.level },
                ] : undefined}
                icon={
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                } />
              <StatCard label="Distance" value={healthState.distance_cm} unit="cm"
                details={d ? [
                  { label: "Status", value: d.distance.status },
                  { label: "Risk Score", value: d.distance.risk_score },
                ] : undefined}
                icon={
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                } />
              <StatCard label="Amb. Light" value={healthState.ambient_light} unit="lx"
                details={d ? [
                  { label: "Brightness", value: d.light.brightness },
                  { label: "Level", value: d.light.level },
                  { label: "Risk", value: d.light.risk },
                ] : undefined}
                icon={
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                } />
              <StatCard label="Posture" value={healthState.posture_score} unit="%"
                details={d ? [
                  { label: "Position", value: d.posture.head_position },
                  { label: "Overall", value: d.posture.overall },
                  { label: "Pitch", value: `${d.posture.pitch}°` },
                  { label: "Yaw", value: `${d.posture.yaw}°` },
                  { label: "Roll", value: `${d.posture.roll}°` },
                  { label: "Risk", value: d.posture.risk },
                ] : undefined}
                icon={
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                } />
            </div>
          </div>

          {/* Right Column: Camera & Logs */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* Camera Preview */}
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl overflow-hidden aspect-video">
              <CameraPlaceholder className="h-full w-full" frameSrc={healthState.camera_frame} />
            </div>

            {/* Log Panel */}
            <div className="h-[200px]">
              <LogPanel logs={logs} />
            </div>
          </div>
        </div>

        {/* AI Insights Section (Bottom) */}
        <div className="pt-4">
          <AIInsights />
        </div>

        {/* Progress Charts Section */}
        <div className="pt-2 pb-6">
          <ProgressCharts />
        </div>

        {/* Modals */}
        <BreakReminderModal
          visible={showBreakReminder}
          reasons={breakReasons}
          recommendations={breakRecs}
          onStartBreak={handleStartBreak}
          onRemindLater={handleRemindLater}
        />
        <StrainAlertModal
          visible={showStrainAlert}
          strainLevel={criticalStrainLevel}
          onConfirm={handleStrainConfirm}
        />
      </div>
    </main>
  );
}
