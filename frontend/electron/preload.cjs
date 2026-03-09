const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendNotification: (title, body) => ipcRenderer.send('notify', { title, body }),
    onAppVisibilityChange: (callback) => {
        ipcRenderer.removeAllListeners('app-visibility');
        ipcRenderer.on('app-visibility', (_event, isVisible) => callback(isVisible));
    }
});
