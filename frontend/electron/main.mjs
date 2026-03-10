import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import serve from 'electron-serve';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initializing serve definition
const loadURL = serve({ directory: 'out' });

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Disable GPU to reduce background memory usage
app.disableHardwareAcceleration();

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;
let tray = null;
let backgroundSocket = null;
let lastBackgroundAlertAtMs = 0;

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
}

function setRendererVisibility(isVisible) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
        mainWindow.webContents.send('app-visibility', isVisible);
    } catch {
        // ignore
    }
}

function startBackgroundMonitoring() {
    // Keep backend computations + notifications alive even when UI is hidden.
    // We intentionally do NOT request camera frames here to save memory/bandwidth.
    if (backgroundSocket) return;
    if (typeof WebSocket === 'undefined') return;

    try {
        const wsUrl = 'ws://localhost:8000/ws/health-stream?include_frame=0&send_fps=1';
        backgroundSocket = new WebSocket(wsUrl);

        backgroundSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const now = Date.now();

                // Simple throttling so we don't spam notifications
                if (now - lastBackgroundAlertAtMs < 5000) return;

                if (typeof data?.overall_strain_index === 'number' && data.overall_strain_index > 80) {
                    lastBackgroundAlertAtMs = now;
                    new Notification({
                        title: 'EyeGuardian',
                        body: `High strain detected: ${data.overall_strain_index}/100. Take a break.`,
                    }).show();
                } else if (data?.details?.blink?.is_dry) {
                    lastBackgroundAlertAtMs = now;
                    new Notification({
                        title: 'EyeGuardian',
                        body: 'Low blink rate detected. Consider a short break.',
                    }).show();
                }
            } catch {
                // ignore
            }
        };

        backgroundSocket.onclose = () => {
            backgroundSocket = null;
            // Only reconnect if we still want monitoring (window still hidden)
            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
                setTimeout(startBackgroundMonitoring, 3000);
            }
        };
    } catch {
        backgroundSocket = null;
    }
}

function stopBackgroundMonitoring() {
    if (backgroundSocket) {
        try { backgroundSocket.close(); } catch { /* ignore */ }
        backgroundSocket = null;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        },
        titleBarStyle: 'hiddenInset',
        show: false
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        // In dev we can optionally enable devtools via an env flag to avoid accidental renderer bloat
        if (process.env.EYEGUARDIAN_ENABLE_DEVTOOLS === "1") {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    } else {
        // When building for production, we use electron-serve
        loadURL(mainWindow);
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('show', () => {
        stopBackgroundMonitoring();
        setRendererVisibility(true);
    });
    mainWindow.on('hide', () => {
        setRendererVisibility(false);
        startBackgroundMonitoring();
    });

    // Close to tray instead of quitting (for background monitoring)
    mainWindow.on('close', (event) => {
        if (app.quitting) {
            return;
        }
        event.preventDefault();
        mainWindow.hide();
    });
}

app.whenReady().then(() => {
    createWindow();
    // NOTE: Do NOT call startBackgroundMonitoring() here.
    // It opens a second WebSocket that grabs the camera and conflicts
    // with the renderer's connection. Background monitoring starts only
    // when the window is hidden (see 'hide' handler above).

    // Create system tray icon for background control
    try {
        const iconPath = path.join(__dirname, 'icon.png');
        const iconImage = nativeImage.createFromPath(iconPath);
        tray = new Tray(iconImage.isEmpty() ? nativeImage.createEmpty() : iconImage);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show EyeGuardian',
                click: () => {
                    showMainWindow();
                },
            },
            {
                label: 'Quit',
                click: () => {
                    app.quitting = true;
                    app.quit();
                },
            },
        ]);

        tray.setToolTip('EyeGuardian');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (!mainWindow || mainWindow.isDestroyed()) {
                createWindow();
                return;
            }
            mainWindow.isVisible() ? mainWindow.hide() : showMainWindow();
        });
    } catch (e) {
        // If tray setup fails, just run without tray
        console.error('Failed to set up tray:', e);
    }

    ipcMain.on('notify', (event, { title, body }) => {
        new Notification({ title, body }).show();
    });

    app.on('activate', function () {
        if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow();
        } else {
            showMainWindow();
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
