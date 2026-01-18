"use client";

import React, { useMemo } from 'react';

interface RadialGaugeProps {
    value: number;
}

const RadialGauge: React.FC<RadialGaugeProps> = ({ value }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    const dashOffset = useMemo(() => {
        const progress = value / 100;
        return circumference * (1 - progress);
    }, [value, circumference]);

    const color = useMemo(() => {
        if (value < 40) return '#10b981'; // Green
        if (value < 70) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    }, [value]);

    return (
        <div className="relative flex items-center justify-center p-4">
            <svg className="w-64 h-64 transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="8"
                />
                {/* Progress Circle */}
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-bold text-white tracking-tighter">{Math.round(value)}</span>
                <span className="text-xs uppercase tracking-widest text-slate-400 mt-1">Strain Index</span>
            </div>
            {/* Glow effect */}
            <div
                className="absolute w-full h-full opacity-20 blur-xl rounded-full transition-colors duration-1000"
                style={{ background: color }}
            ></div>
        </div>
    );
};

export default RadialGauge;
