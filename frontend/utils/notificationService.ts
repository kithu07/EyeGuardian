import {
    playHighStrainSound,
    playBreakReminderSound,
    playPostureAlertSound,
    playBlinkAlertSound,
    playRednessAlertSound,
    playLightingAlertSound,
    playDistanceAlertSound,
    playMultipleIssuesSound
} from './soundNotification';

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
    sendNativeNotification('🚨 Eye Strain Alert', `Strain Level Critical: ${level}/100. Take a break!`);
    playHighStrainSound();
}

export function alertBreakReminder(issues: string[] = []) {
    const baseMessage = 'Time for a short break to protect your eyes.';
    const issuesMessage = issues.length > 0 ? `\n\nIssues detected:\n• ${issues.join('\n• ')}` : '';
    sendNativeNotification('⏰ Break Reminder', `${baseMessage}${issuesMessage}`);
    playBreakReminderSound();
}

export function alertPostureIssue() {
    sendNativeNotification('📍 Posture Alert', 'Poor posture detected. Please sit up straight.');
    playPostureAlertSound();
}

export function alertBlinkRate() {
    sendNativeNotification('👁️ Blink Reminder', 'Your blink rate is low. Remember to blink more frequently.');
    playBlinkAlertSound();
}

export function alertEyeRedness() {
    sendNativeNotification('🔴 Eye Health Alert', 'Eye redness detected. Consider resting your eyes.');
    playRednessAlertSound();
}

export function alertLightingIssue() {
    sendNativeNotification('💡 Lighting Issue', 'Lighting conditions may be affecting your eye health.');
    playLightingAlertSound();
}

export function alertDistanceIssue() {
    sendNativeNotification('📺 Screen Distance', 'You may be sitting too close to the screen.');
    playDistanceAlertSound();
}

export function alertMultipleIssues(issueCount: number) {
    sendNativeNotification('⚠️ Multiple Health Issues', `Detected ${issueCount} issues with your eye health. Time for a break!`);
    playMultipleIssuesSound();
}
