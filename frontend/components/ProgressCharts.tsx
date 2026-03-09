"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DailySummary {
  date: string;
  avg_strain_index: number;
  avg_blink_rate: number;
  avg_posture_score: number;
  avg_redness: number;
  avg_distance_cm: number;
  avg_brightness: number;
  total_session_minutes: number;
  alert_count: number;
}

interface MonthlySummary {
  year: number;
  month: number;
  avg_strain_index: number;
  avg_blink_rate: number;
  avg_posture_score: number;
  avg_redness: number;
  avg_distance_cm: number;
  avg_brightness: number;
  total_session_minutes: number;
  alert_count: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const COLORS = {
  strain: "#ef4444",    // danger red
  blink: "#0ea5e9",     // primary sky
  posture: "#10b981",   // success green
  redness: "#f59e0b",   // warning amber
  distance: "#a78bfa",  // violet
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700/60 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-lg">
      <p className="text-slate-300 text-xs font-semibold mb-2 tracking-wide uppercase">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-400 text-xs">{entry.name}:</span>
          <span className="text-white text-xs font-bold ml-auto">
            {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ProgressCharts = () => {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dailyRes, monthlyRes] = await Promise.all([
          fetch("http://localhost:8000/api/daily-summaries?days=7"),
          fetch("http://localhost:8000/api/monthly-summaries?months=6"),
        ]);

        if (!dailyRes.ok || !monthlyRes.ok) {
          throw new Error("Failed to fetch chart data");
        }

        const dailyRaw: DailySummary[] = await dailyRes.json();
        const monthlyRaw: MonthlySummary[] = await monthlyRes.json();

        // daily → weekly chart data (reverse for chronological order)
        const weekly = [...dailyRaw].reverse().map((d) => {
          const dt = new Date(d.date);
          const dayLabel = dt.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return {
            name: dayLabel,
            "Strain Index": +(d.avg_strain_index || 0).toFixed(1),
            "Blink Rate": +(d.avg_blink_rate || 0).toFixed(1),
            "Posture Score": +(d.avg_posture_score || 0).toFixed(1),
            "Redness": +((d.avg_redness || 0) * 100).toFixed(1),
            "Distance (cm)": +(d.avg_distance_cm || 0).toFixed(1),
          };
        });

        // monthly chart data
        const monthly = [...monthlyRaw].reverse().map((m) => ({
          name: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
          "Strain Index": +(m.avg_strain_index || 0).toFixed(1),
          "Blink Rate": +(m.avg_blink_rate || 0).toFixed(1),
          "Posture Score": +(m.avg_posture_score || 0).toFixed(1),
          "Redness": +((m.avg_redness || 0) * 100).toFixed(1),
          "Distance (cm)": +(m.avg_distance_cm || 0).toFixed(1),
        }));

        setWeeklyData(weekly);
        setMonthlyData(monthly);
      } catch (err: any) {
        console.error("Error fetching chart data:", err);
        setError(err.message || "Failed to load chart data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const chartData = activeTab === "weekly" ? weeklyData : monthlyData;
  const hasData = chartData.length > 0;

  return (
    <div className="bg-gradient-to-r from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              Health Progress Tracker
            </h2>
            <p className="text-slate-400 text-sm">
              Track your eye health trends over time
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-800/80 rounded-xl border border-slate-700/50 p-1">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "weekly"
                ? "bg-primary/20 text-primary shadow-lg shadow-primary/10 border border-primary/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "monthly"
                ? "bg-primary/20 text-primary shadow-lg shadow-primary/10 border border-primary/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            <p className="text-slate-400 text-sm animate-pulse">Loading chart data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <svg className="w-16 h-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-slate-400 text-sm font-medium">No data yet</p>
            <p className="text-slate-500 text-xs">
              Start a monitoring session to see your progress trends
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Single unified chart with all metrics */}
            <div className="bg-slate-900/40 rounded-xl border border-slate-700/30 p-4">
              <h3 className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Eye Health Metrics Overview
              </h3>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 6" opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 16 }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-slate-300 text-xs ml-1">{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="Strain Index"
                    stroke={COLORS.strain}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLORS.strain, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: COLORS.strain, strokeWidth: 2, fill: "#0f172a" }}
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="Blink Rate"
                    stroke={COLORS.blink}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLORS.blink, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: COLORS.blink, strokeWidth: 2, fill: "#0f172a" }}
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="Posture Score"
                    stroke={COLORS.posture}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLORS.posture, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: COLORS.posture, strokeWidth: 2, fill: "#0f172a" }}
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="Redness"
                    stroke={COLORS.redness}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLORS.redness, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: COLORS.redness, strokeWidth: 2, fill: "#0f172a" }}
                    strokeDasharray="5 3"
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="Distance (cm)"
                    stroke={COLORS.distance}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLORS.distance, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: COLORS.distance, strokeWidth: 2, fill: "#0f172a" }}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Color Legend Reference */}
            <div className="flex flex-wrap gap-4 justify-center pt-2">
              {[
                { label: "Strain Index (%)", color: COLORS.strain, desc: "Lower is better" },
                { label: "Blink Rate (bpm)", color: COLORS.blink, desc: "15-20 ideal" },
                { label: "Posture Score (%)", color: COLORS.posture, desc: "Higher is better" },
                { label: "Eye Redness (%)", color: COLORS.redness, desc: "Lower is better" },
                { label: "Distance (cm)", color: COLORS.distance, desc: "50-70 ideal" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 bg-slate-800/40 rounded-lg px-3 py-1.5 border border-slate-700/30"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-300 text-[11px] font-medium">{item.label}</span>
                  <span className="text-slate-500 text-[10px]">({item.desc})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressCharts;
