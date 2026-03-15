import React, { useState, useEffect } from 'react';
import { initAlertSound, playAlertSound, setAlertVolume } from '@/utils/rendererSoundPlayer';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
    const [backgroundMonitoring, setBackgroundMonitoring] = useState(false);
    const [autoStart, setAutoStart] = useState(false);
    const [soundVolume, setSoundVolume] = useState(70);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const loadSettings = React.useCallback(async () => {
        try {
            // Check auto-start status
            if (window.electronAPI?.getAutoStartStatus) {
                const autoStartStatus = await window.electronAPI.getAutoStartStatus();
                setAutoStart(autoStartStatus);
            }

            // Check notification permissions
            if (window.electronAPI?.checkNotificationPermissions) {
                const permissions = await window.electronAPI.checkNotificationPermissions();
                setNotificationsEnabled(permissions.granted);
            }

            // Load background monitoring status from main process
            if (window.electronAPI?.getBackgroundMonitoring) {
                const bgMonitoring = await window.electronAPI.getBackgroundMonitoring();
                setBackgroundMonitoring(bgMonitoring);
            }

            // Load volume from localStorage
            const savedVolume = localStorage.getItem('soundVolume');
            const volume = savedVolume !== null ? parseInt(savedVolume, 10) : soundVolume;
            setSoundVolume(volume);

            // Initialize Web Audio alert player (for in-app audio alerts)
            await initAlertSound('/break-reminder.wav', volume / 100);
            setAlertVolume(volume);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }, [soundVolume]);

    useEffect(() => {
        if (isOpen) {
            // Load settings after paint to avoid sync state updates in render.
            const initTimer = window.setTimeout(() => {
                loadSettings();
            }, 0);

            // Add ESC key handler to close settings
            const handleEscKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };

            window.addEventListener('keydown', handleEscKey);
            return () => {
                window.clearTimeout(initTimer);
                window.removeEventListener('keydown', handleEscKey);
            };
        }
    }, [isOpen, onClose, loadSettings]);

    const handleAutoStartChange = async (enabled: boolean) => {
        try {
            if (window.electronAPI?.setAutoStart) {
                const success = await window.electronAPI.setAutoStart(enabled);
                if (success) {
                    setAutoStart(enabled);
                }
            }
        } catch (error) {
            console.error('Failed to set auto-start:', error);
        }
    };

    const handleBackgroundMonitoringChange = async (enabled: boolean) => {
        try {
            if (window.electronAPI?.setBackgroundMonitoring) {
                const success = await window.electronAPI.setBackgroundMonitoring(enabled);
                if (success) {
                    setBackgroundMonitoring(enabled);
                }
            }
        } catch (error) {
            console.error('Failed to set background monitoring:', error);
        }
    };

    const handleVolumeChange = (volume: number) => {
        setSoundVolume(volume);
        localStorage.setItem('soundVolume', volume.toString());
        setAlertVolume(volume);
    };

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking directly on the backdrop (not the modal)
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={handleBackdropClick}
        >
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-300 hover:text-white hover:bg-slate-700 rounded-full p-2 W-8 h-8 flex items-center justify-center transition-colors"
                        title="Close settings (ESC)"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-6">
                    {/* System Startup */}
                    <div className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-3">System Integration</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-white font-medium">Start on System Boot</label>
                                <p className="text-slate-400 text-sm">Launch EyeGuardian automatically when your computer starts</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoStart}
                                    onChange={(e) => handleAutoStartChange(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Background Monitoring */}
                    <div className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-3">Monitoring</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-white font-medium">Background Monitoring</label>
                                <p className="text-slate-400 text-sm">Continue monitoring when app is minimized</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={backgroundMonitoring}
                                    onChange={(e) => handleBackgroundMonitoringChange(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-3">Audio</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-white font-medium">Alert Volume (In-App Only)</label>
                                <p className="text-slate-400 text-xs mb-2">Audio alerts only play when app is active (not in background)</p>
                                <div className="flex items-center space-x-3 mt-2">
                                    <span className="text-slate-400 text-sm">🔇</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={soundVolume}
                                        onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                                        className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <span className="text-slate-400 text-sm">🔊</span>
                                    <span className="text-white text-sm w-8">{soundVolume}%</span>
                                </div>
                            </div>
                            <div className="bg-slate-600 rounded p-3 text-xs text-slate-300">
                                <strong>Note:</strong> Background mode uses only visual notifications (no audio) to prevent fatigue. Sounds play when the app window is active.
                            </div>
                            <button
                                onClick={() => {
                                    // Play via Web Audio API (volume controlled)
                                    playAlertSound();

                                    // Fallback: play system sound via Electron if Web Audio isn't available
                                    if (window.electronAPI?.playHighStrainSound) {
                                        window.electronAPI.playHighStrainSound();
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                                Test Sound (App Must Be Active)
                            </button>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-3">Notifications</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-white font-medium">System Notifications</label>
                                <p className="text-slate-400 text-sm">
                                    {notificationsEnabled ? 'Notifications are enabled' : 'Notifications are disabled - check system settings'}
                                </p>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${notificationsEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <div className="text-xs text-slate-400">
                        Tip: Press <span className="bg-slate-700 px-2 py-1 rounded text-slate-300">ESC</span> or click outside to close
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;