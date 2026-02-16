"use client";

import React, { ReactNode, useState } from 'react';

interface DetailItem {
    label: string;
    value: string | number | boolean;
}

interface StatCardProps {
    label: string;
    value: number | string;
    unit: string;
    icon?: ReactNode;
    details?: DetailItem[];
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon, details }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-start min-w-[140px] relative overflow-hidden group">
            <button
                className="absolute top-0 right-0 p-4 opacity-50 hover:opacity-100 transition-opacity z-20 cursor-pointer"
                onClick={() => details && details.length > 0 && setExpanded(!expanded)}
                title={details && details.length > 0 ? (expanded ? "Hide details" : "Show details") : undefined}
            >
                {icon}
            </button>
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2 z-10">{label}</div>
            <div className="text-3xl font-bold text-white z-10 flex items-baseline gap-1">
                {value}
                <span className="text-sm font-normal text-slate-500">{unit}</span>
            </div>

            {/* Expandable Details Panel */}
            {expanded && details && details.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 w-full space-y-1.5 z-10">
                    {details.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-500">{d.label}</span>
                            <span className="text-slate-300 font-mono">
                                {typeof d.value === 'boolean' ? (d.value ? 'Yes' : 'No') : d.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Background Gradient element */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all duration-500"></div>
        </div>
    );
};

export default StatCard;
