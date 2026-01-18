import React, { ReactNode } from 'react';

interface StatCardProps {
    label: string;
    value: number | string;
    unit: string;
    icon?: ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon }) => {
    return (
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-start min-w-[140px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                {icon}
            </div>
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2 z-10">{label}</div>
            <div className="text-3xl font-bold text-white z-10 flex items-baseline gap-1">
                {value}
                <span className="text-sm font-normal text-slate-500">{unit}</span>
            </div>

            {/* Background Gradient element */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all duration-500"></div>
        </div>
    );
};

export default StatCard;
