import React from 'react';
import clsx from 'clsx';

export interface Log {
    id: number;
    message: string;
    time: string;
    type: 'info' | 'warning' | 'danger';
}

interface LogPanelProps {
    logs: Log[];
}

const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
    const getStatusColor = (type: string) => {
        switch (type) {
            case 'warning': return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]';
            case 'danger': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
            default: return 'bg-primary shadow-[0_0_8px_rgba(14,165,233,0.5)]';
        }
    }

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>System Logs</span>
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 relative">
                <div className="space-y-2">
                    {logs.map((log) => (
                        <div key={log.id}
                            className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/30 text-sm flex items-start gap-3 transition-all duration-500">
                            <div className={clsx("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", getStatusColor(log.type))}></div>
                            <div className="flex-1">
                                <div className="text-slate-300">{log.message}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{log.time}</div>
                            </div>
                        </div>
                    ))}
                </div>
                {logs.length === 0 && <div className="text-slate-600 text-center italic mt-10">No recent alerts</div>}
            </div>
        </div>
    );
};

export default LogPanel;
