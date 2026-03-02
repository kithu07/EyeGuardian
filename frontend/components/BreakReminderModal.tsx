import React from 'react';
import clsx from 'clsx';

interface BreakReminderModalProps {
    visible: boolean;
    reasons: string[];
    recommendations: string[];
    onStartBreak: () => void;
    onRemindLater: () => void;
}

const BreakReminderModal: React.FC<BreakReminderModalProps> = ({
    visible, reasons, recommendations, onStartBreak, onRemindLater
}) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full relative">
                <h2 className="text-xl font-bold mb-4 text-primary">Time for a Break</h2>
                {reasons.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-semibold">Issues detected:</h3>
                        <ul className="list-disc list-inside mt-2 text-sm">
                            {reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}
                {recommendations.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold">Recommendations:</h3>
                        <ul className="list-disc list-inside mt-2 text-sm">
                            {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}
                <div className="flex justify-end gap-4">
                    <button
                        className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                        onClick={onRemindLater}
                    >Remind Later</button>
                    <button
                        className="px-4 py-2 bg-primary rounded-lg hover:bg-primary/90 text-white"
                        onClick={onStartBreak}
                    >Start Break</button>
                </div>
            </div>
        </div>
    );
};

export default BreakReminderModal;