import React from 'react';

interface StrainAlertModalProps {
    visible: boolean;
    strainLevel: number;
    onConfirm: () => void;
}

const StrainAlertModal: React.FC<StrainAlertModalProps> = ({ visible, strainLevel, onConfirm }) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-red-800 rounded-2xl p-8 max-w-md w-full text-white">
                <h2 className="text-2xl font-bold mb-4">⚠️ Critical Strain</h2>
                <p className="mb-6">Your eye strain level has reached {strainLevel}. Please take a break immediately.</p>
                <div className="flex justify-end">
                    <button
                        className="px-4 py-2 bg-white text-red-800 rounded-lg hover:bg-white/90"
                        onClick={onConfirm}
                    >Okay, I'll take a break</button>
                </div>
            </div>
        </div>
    );
};

export default StrainAlertModal;