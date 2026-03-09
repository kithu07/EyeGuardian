import { playHighStrainSound, playBreakReminderSound } from './soundNotification';

// wrapper for toast logs and native notifications
export function sendAppLog(message: string, type: 'info' | 'warning' | 'danger' = 'info', addLogFn?: (msg: string, t: 'info'|'warning'|'danger')=>void) {
    if (addLogFn) addLogFn(message, type);
    // could add toast library here if desired
}

export function sendNativeNotification(title: string, body: string) {
    if (typeof window !== 'undefined' && window.electronAPI?.sendNotification) {
        window.electronAPI.sendNotification(title, body);
    } else {
        // fallback to browser alert
        console.log('Notification:', title, body);
    }
}

export function alertHighStrain(level: number) {
    sendNativeNotification('Eye Health Alert', `Strain Level Critical: ${level}. Take a break!`);
    playHighStrainSound();
}

export function alertBreakReminder() {
    sendNativeNotification('Break Reminder', `Time for a short break.`);
    playBreakReminderSound();
}
