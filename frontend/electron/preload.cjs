const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendNotification: (title, body) => ipcRenderer.send('notify', { title, body }),
    checkNotificationPermissions: () => ipcRenderer.invoke('check-notification-permissions'),
    playSound: (soundType) => ipcRenderer.send('play-sound', soundType),
    playHighStrainSound: () => ipcRenderer.send('play-high-strain-sound'),
    playBreakReminderSound: () => ipcRenderer.send('play-break-reminder-sound'),
    playPostureAlertSound: () => ipcRenderer.send('play-posture-alert-sound'),
    playBlinkAlertSound: () => ipcRenderer.send('play-blink-alert-sound'),
    playRednessAlertSound: () => ipcRenderer.send('play-redness-alert-sound'),
    playLightingAlertSound: () => ipcRenderer.send('play-lighting-alert-sound'),
    playDistanceAlertSound: () => ipcRenderer.send('play-distance-alert-sound'),
    playMultipleIssuesSound: () => ipcRenderer.send('play-multiple-issues-sound'),
    getAutoStartStatus: () => ipcRenderer.invoke('get-auto-start-status'),
    setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
    getBackgroundMonitoring: () => ipcRenderer.invoke('get-background-monitoring'),
    setBackgroundMonitoring: (enabled) => ipcRenderer.invoke('set-background-monitoring', enabled),
    onAppVisibilityChange: (callback) => {
        ipcRenderer.removeAllListeners('app-visibility');
        ipcRenderer.on('app-visibility', (_event, isVisible) => callback(isVisible));
    },
    startBreakMode: () => ipcRenderer.send('start-break-mode'),
});
