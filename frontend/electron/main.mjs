import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, dialog } from 'electron';
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

// On Windows, notifications require an AppUserModelID to display properly.
// This also ensures toast notifications work even when the app is not in the foreground.
if (process.platform === 'win32') {
    app.setAppUserModelId('com.eyeGuardian.EyeGuardian');
}

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;
let tray = null;
let backgroundSocket = null;
let breakWindow = null;
let breakTimer = null;
let lastBackgroundFailures = [];
let lastBackgroundAlertAtMs = 0;
let lastBreakReminderAtMs = 0; // Track when last break reminder was shown
let currentHealthStatus = 'good'; // 'good', 'warning', 'critical'
let backgroundMonitoringEnabled = true; // Default to enabled; can be toggled via Settings
let notificationSetupDialogShown = false; // Prevent repeating the setup dialog

// Break reminder settings
const BREAK_REMINDER_INTERVAL = 60 * 60 * 1000; // 60 minutes between break reminders (matches UI behavior)
const BREAK_WARNING_INTERVAL = 2 * 60 * 1000; // Warn after 2 minutes without break

// Per-sound throttling to prevent spam
const soundThrottleMs = {};
const SOUND_THROTTLE_DURATION = 4 * 60 * 1000; // 4 minutes between same sounds
const GLOBAL_THROTTLE_DURATION = 3 * 60 * 1000; // 3 minutes between any alerts

function canPlaySound(soundType) {
    const now = Date.now();
    const lastTime = soundThrottleMs[soundType] || 0;
    
    if (now - lastTime < SOUND_THROTTLE_DURATION) {
        return false; // Still throttled
    }
    
    soundThrottleMs[soundType] = now;
    return true;
}

// Native audio player - disabled in background to prevent media player pop-ups
const alertSoundPath = path.join(__dirname, 'sounds', 'break-reminder.wav');

// System startup management
let autoStartEnabled = false;

function setupSystemStartup() {
    const platform = process.platform;
    const exePath = process.execPath;
    const appName = 'EyeGuardian';

    try {
        if (platform === 'win32') {
            // Windows: Use registry for startup
            const Registry = require('winreg');
            const key = new Registry({
                hive: Registry.HKCU,
                key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
            });

            key.get(appName, (err, item) => {
                autoStartEnabled = !err && item && item.value === exePath;
            });

        } else if (platform === 'darwin') {
            // macOS: Use Launch Agents
            const { execSync } = require('child_process');
            const homeDir = require('os').homedir();
            const plistPath = path.join(homeDir, 'Library', 'LaunchAgents', `com.eyeGuardian.${appName}.plist`);

            try {
                execSync(`launchctl list | grep com.eyeGuardian.${appName}`, { stdio: 'pipe' });
                autoStartEnabled = true;
            } catch {
                autoStartEnabled = false;
            }

        } else if (platform === 'linux') {
            // Linux: Use .config/autostart
            const { execSync } = require('child_process');
            const homeDir = require('os').homedir();
            const autostartDir = path.join(homeDir, '.config', 'autostart');
            const desktopFile = path.join(autostartDir, `${appName}.desktop`);

            try {
                const fs = require('fs');
                autoStartEnabled = fs.existsSync(desktopFile);
            } catch {
                autoStartEnabled = false;
            }
        }
    } catch (error) {
        console.warn('Failed to check system startup status:', error);
        autoStartEnabled = false;
    }
}

function setSystemStartup(enabled) {
    const platform = process.platform;
    const exePath = process.execPath;
    const appName = 'EyeGuardian';

    try {
        if (platform === 'win32') {
            const Registry = require('winreg');
            const key = new Registry({
                hive: Registry.HKCU,
                key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
            });

            if (enabled) {
                key.set(appName, Registry.REG_SZ, exePath, (err) => {
                    if (err) console.warn('Failed to enable Windows startup:', err);
                    else autoStartEnabled = true;
                });
            } else {
                key.remove(appName, (err) => {
                    if (err) console.warn('Failed to disable Windows startup:', err);
                    else autoStartEnabled = false;
                });
            }

        } else if (platform === 'darwin') {
            const { execSync } = require('child_process');
            const homeDir = require('os').homedir();
            const plistPath = path.join(homeDir, 'Library', 'LaunchAgents', `com.eyeGuardian.${appName}.plist`);

            if (enabled) {
                const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.eyeGuardian.${appName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${exePath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>`;

                const fs = require('fs');
                fs.mkdirSync(path.dirname(plistPath), { recursive: true });
                fs.writeFileSync(plistPath, plistContent);
                execSync(`launchctl load "${plistPath}"`);
                autoStartEnabled = true;
            } else {
                try {
                    execSync(`launchctl unload "${plistPath}"`);
                    const fs = require('fs');
                    if (fs.existsSync(plistPath)) fs.unlinkSync(plistPath);
                } catch {}
                autoStartEnabled = false;
            }

        } else if (platform === 'linux') {
            const homeDir = require('os').homedir();
            const autostartDir = path.join(homeDir, '.config', 'autostart');
            const desktopFile = path.join(autostartDir, `${appName}.desktop`);

            if (enabled) {
                const desktopContent = `[Desktop Entry]
Type=Application
Name=${appName}
Exec="${exePath}"
StartupNotify=false
Terminal=false
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true`;

                const fs = require('fs');
                fs.mkdirSync(autostartDir, { recursive: true });
                fs.writeFileSync(desktopFile, desktopContent);
                autoStartEnabled = true;
            } else {
                const fs = require('fs');
                if (fs.existsSync(desktopFile)) {
                    fs.unlinkSync(desktopFile);
                }
                autoStartEnabled = false;
            }
        }

        return true;
    } catch (error) {
        console.error('Failed to set system startup:', error);
        return false;
    }
}

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

function createBreakWindow(durationMs = 5 * 60 * 1000) {
    // If already in break mode, bring it to front
    if (breakWindow && !breakWindow.isDestroyed()) {
        breakWindow.focus();
        return;
    }

    // Hide the main window while on break
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
    }

    breakWindow = new BrowserWindow({
        fullscreen: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        frame: false,
        modal: true,
        show: false,
        skipTaskbar: true,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Take a Break</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: black;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                }
                .container {
                    max-width: 600px;
                    padding: 24px;
                }
                h1 {
                    font-size: 2.4rem;
                    margin-bottom: 0.5rem;
                }
                p {
                    margin: 0.75rem 0;
                    font-size: 1.1rem;
                }
                .timer {
                    font-size: 3.2rem;
                    font-weight: 700;
                    margin: 1rem 0;
                }
                button {
                    padding: 12px 24px;
                    border-radius: 999px;
                    border: 2px solid rgba(255,255,255,0.25);
                    background: rgba(255,255,255,0.08);
                    color: white;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: transform 0.15s ease, background 0.15s ease;
                }
                button:hover {
                    background: rgba(255,255,255,0.18);
                    transform: scale(1.02);
                }
                button:active {
                    transform: scale(0.98);
                }
                .footer {
                    margin-top: 1.5rem;
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.65);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Time for a break!</h1>
                <p>Take a moment to rest your eyes and stretch.</p>
                <div class="timer" id="timer">${Math.ceil(durationMs / 1000)}</div>
                <button id="endBtn">End Break Early</button>
                <div class="footer">This window will close automatically when the timer ends.</div>
            </div>
            <script>
                const durationMs = ${durationMs};
                let remaining = durationMs;
                const timerEl = document.getElementById('timer');

                const update = () => {
                    remaining -= 1000;
                    if (remaining <= 0) {
                        window.close();
                        return;
                    }
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    timerEl.textContent = minutes.toString().padStart(2,'0') + ':' + seconds.toString().padStart(2,'0');
                };

                const interval = setInterval(update, 1000);

                document.getElementById('endBtn').addEventListener('click', () => {
                    window.close();
                });

                window.addEventListener('beforeunload', () => {
                    clearInterval(interval);
                });
            </script>
        </body>
        </html>
    `;

    breakWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    breakWindow.once('ready-to-show', () => {
        breakWindow.show();
    });

    breakWindow.on('closed', () => {
        breakWindow = null;
        if (breakTimer) {
            clearTimeout(breakTimer);
            breakTimer = null;
        }
        // Bring main window back
        if (mainWindow && !mainWindow.isDestroyed()) {
            showMainWindow();
        }
    });

    // Automatically close after duration
    if (breakTimer) {
        clearTimeout(breakTimer);
    }
    breakTimer = setTimeout(() => {
        if (breakWindow && !breakWindow.isDestroyed()) {
            breakWindow.close();
        }
    }, durationMs);
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
    // Only start if user has enabled background monitoring in Settings
    if (!backgroundMonitoringEnabled) {
        console.debug('Background monitoring disabled by user settings');
        return;
    }
    
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

                // Evaluate all health metrics for potential issues
                const failures = evaluateBackgroundHealth(data);
                lastBackgroundFailures = failures.map(f => f.message);

                // Check if break reminder is due (every 60 minutes)
                if (now - lastBreakReminderAtMs >= BREAK_REMINDER_INTERVAL) {
                    lastBreakReminderAtMs = now;
                    showBreakReminder(lastBackgroundFailures);
                }

                // Global throttling: max one alert every 3 minutes
                if (now - lastBackgroundAlertAtMs < GLOBAL_THROTTLE_DURATION) return;

                // Update tray icon based on health status
                let healthStatus = 'good';
                if (failures.some(f => f.priority === 'critical')) {
                    healthStatus = 'critical';
                } else if (failures.some(f => f.priority === 'high') || failures.length > 0) {
                    healthStatus = 'warning';
                }
                updateTrayIcon(healthStatus);

                if (failures.length > 0) {
                    // Prioritize failures: critical > high > medium > low
                    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                    failures.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

                    // Handle single failure or multiple failures
                    let notificationToShow;
                    let soundToPlay;

                    if (failures.length === 1) {
                        // Single failure - use its specific notification
                        notificationToShow = failures[0].notification;
                        soundToPlay = failures[0].sound;
                    } else {
                        // Multiple failures - use escalated notification
                        const criticalCount = failures.filter(f => f.priority === 'critical').length;
                        const highCount = failures.filter(f => f.priority === 'high').length;

                        notificationToShow = {
                            title: '⚠️ Multiple Health Issues',
                            body: `Detected ${failures.length} issues: ${failures.slice(0, 2).map(f => f.message.toLowerCase()).join(', ')}${failures.length > 2 ? '...' : ''}. Time for a break!`
                        };
                        soundToPlay = 'multipleIssues';
                    }

                    // Show notification AND play sound (even in background!)
                    lastBackgroundAlertAtMs = now;
                    
                    // Play notification sound
                    if (soundToPlay && canPlaySound(soundToPlay)) {
                        playSound(soundToPlay);
                    }
                    
                    // Show native notification
                    new Notification(notificationToShow).show();
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

function playSound(soundType) {
    // Play system notification sound - works even when app is in background
    const { systemPreferences } = require('electron');
    
    try {
        if (process.platform === 'darwin') {
            // macOS: Play system sound
            require('child_process').exec('afplay /System/Library/Sounds/Glass.aiff');
        } else if (process.platform === 'win32') {
            // Windows: Play system notification sound via PowerShell (silent/non-blocking)
            const { execSync } = require('child_process');
            try {
                // Use Windows built-in notification sound
                execSync('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemSounds]::Beep.Play()"', 
                    { windowsHide: true, timeout: 100 });
            } catch (e) {
                // Fallback: just beep
                process.stdout.write('\x07'); // ASCII bell
            }
        } else if (process.platform === 'linux') {
            // Linux: Play system sound
            try {
                require('child_process').exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga', 
                    { stdio: 'ignore' });
            } catch {
                // Fallback: system beep
                process.stdout.write('\x07');
            }
        }
    } catch (error) {
        console.debug(`Could not play system sound: ${error.message}`);
    }
}

function updateTrayIcon(status) {
    if (!tray) return;

    currentHealthStatus = status;
    const iconName = status === 'critical' ? 'icon-red.png' :
                     status === 'warning' ? 'icon-yellow.png' : 'icon.png';

    try {
        const iconPath = path.join(__dirname, iconName);
        if (require('fs').existsSync(iconPath)) {
            const iconImage = nativeImage.createFromPath(iconPath);
            tray.setImage(iconImage.isEmpty() ? nativeImage.createEmpty() : iconImage);
        }
    } catch (error) {
        console.warn('Failed to update tray icon:', error);
    }

    // Update tooltip
    const statusText = status === 'critical' ? 'Eye Health: Critical' :
                      status === 'warning' ? 'Eye Health: Warning' : 'Eye Health: Good';
    tray.setToolTip(`EyeGuardian - ${statusText}`);
}

function showBreakReminder(issues = []) {
    // Only show break reminder if the app is minimized/hidden
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        console.debug('Break reminder skipped - app is visible');
        return;
    }

    const recommendations = [
        '👀 Look away from screen for 20 seconds',
        '🚶 Stand up and walk around for 2-3 minutes',
        '💧 Rest your eyes with the 20-20-20 rule: every 20 min, look at something 20 feet away for 20 sec',
        '🫖 Take a brief pause from work',
        '💪 Do some shoulder and neck stretches'
    ];
    
    const recommendation = recommendations[Math.floor(Math.random() * recommendations.length)];

    const issuesMessage = issues.length > 0 ? `\n\nIssues detected:\n• ${issues.join('\n• ')}` : '';
    
    const notification = new Notification({
        title: '⏰ Time for a Break!',
        body: `You've been working for a while. ${recommendation}${issuesMessage}\n\nContinue in EyeGuardian for detailed recommendations.`,
        urgency: 'normal'
    });

    // Play break reminder sound
    if (canPlaySound('breakReminder')) {
        playSound('breakReminder');
    }

    notification.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            showMainWindow();
        }
    });
}

////////////////////////////////////////////////////////////////////////////////
// BACKGROUND HEALTH EVALUATION SYSTEM
//
// Mirrors the frontend's evaluateHealthState() but optimized for background monitoring
////////////////////////////////////////////////////////////////////////////////

function evaluateBackgroundHealth(state) {
    const failures = [];

    // High strain (critical - triggers immediate alert)
    if (state.overall_strain_index >= 80) {
        failures.push({
            code: 'strain_critical',
            message: 'Critical eye strain detected',
            priority: 'critical',
            sound: 'highStrain',
            notification: {
                title: '🚨 Eye Strain Alert',
                body: `Strain level: ${Math.round(state.overall_strain_index)}/100. Take a break immediately!`
            }
        });
    } else if (state.overall_strain_index >= 70) {
        failures.push({
            code: 'strain_high',
            message: 'High eye strain detected',
            priority: 'high',
            sound: 'highStrain',
            notification: {
                title: '⚠️ Eye Strain Warning',
                body: `Strain level: ${Math.round(state.overall_strain_index)}/100. Consider taking a break.`
            }
        });
    }

    // Posture issues
    if (state.posture_score < 60 || (state.details?.posture?.risk ?? 0) > 0.5) {
        failures.push({
            code: 'posture',
            message: 'Poor posture detected',
            priority: 'medium',
            sound: 'postureAlert',
            notification: {
                title: '📍 Posture Alert',
                body: 'Poor posture detected. Please sit up straight and adjust your position.'
            }
        });
    }

    // Blink rate issues
    if (state.blink_rate < 15) {
        failures.push({
            code: 'blink',
            message: 'Low blink rate detected',
            priority: 'medium',
            sound: 'blinkAlert',
            notification: {
                title: '👁️ Blink Reminder',
                body: 'Your blink rate is low. Remember to blink more frequently to keep your eyes moist.'
            }
        });
    }

    // Eye redness
    if (state.redness > 0.7) {
        failures.push({
            code: 'redness',
            message: 'Eye redness detected',
            priority: 'medium',
            sound: 'rednessAlert',
            notification: {
                title: '🔴 Eye Health Alert',
                body: 'Eye redness detected. Consider resting your eyes or using eye drops.'
            }
        });
    }

    // Lighting issues
    if (state.details?.light?.risk > 1) {
        failures.push({
            code: 'lighting',
            message: 'Poor lighting conditions',
            priority: 'low',
            sound: 'lightingAlert',
            notification: {
                title: '💡 Lighting Issue',
                body: 'Lighting conditions may be affecting your eye health. Consider adjusting room lighting.'
            }
        });
    }

    // Distance issues
    if (state.details?.distance?.risk_score > 0.5) {
        failures.push({
            code: 'distance',
            message: 'Screen distance issue',
            priority: 'low',
            sound: 'distanceAlert',
            notification: {
                title: '📺 Screen Distance',
                body: 'You may be sitting too close to the screen. Try moving back for better eye health.'
            }
        });
    }

    return failures;
}

////////////////////////////////////////////////////////////////////////////////
// NOTIFICATION PERMISSION SYSTEM
//
// EyeGuardian requires notification permissions to alert users about:
// - High eye strain levels (>80)
// - Break reminders (every hour + health failures)
// - Poor posture detection
// - Low blink rate warnings
// - Eye redness alerts
// - Lighting and distance issues
//
// Cross-platform support:
// - macOS: Uses Notification.requestPermission() API
// - Windows: Relies on system notification settings
// - Linux: Depends on desktop environment notification daemon
//
// The app will show permission dialogs if notifications are disabled
////////////////////////////////////////////////////////////////////////////////

function checkNotificationPermissions() {
    // Cross-platform notification permission handling
    const platform = process.platform;

    if (!Notification.isSupported()) {
        console.warn('Notifications are not supported on this system');
        return;
    }

    // macOS: Show a test notification to trigger permission request
    if (platform === 'darwin') {
        try {
            new Notification({
                title: 'EyeGuardian Started',
                body: 'Notifications are working! You can minimize this app and it will continue monitoring in the background.',
                silent: true
            }).show();
        } catch (err) {
            if (!notificationSetupDialogShown) {
                notificationSetupDialogShown = true;
                showNotificationSetupDialog();
                console.log('macOS notification permission denied, setup dialog shown');
            }
        }
    }
    // Windows: Ensure app has a valid AppUserModelID and show a test notification
    else if (platform === 'win32') {
        try {
            new Notification({
                title: 'EyeGuardian Started',
                body: 'Notifications are working! You can minimize this app and it will continue monitoring in the background.',
                silent: true
            }).show();
        } catch (err) {
            if (!notificationSetupDialogShown) {
                notificationSetupDialogShown = true;
                showNotificationSetupDialog();
            }
            console.warn('Windows notification test failed, showing setup dialog:', err);
        }
    }
    // Linux: Show a test notification (many DEs require a running notification daemon)
    else if (platform === 'linux') {
        try {
            new Notification({
                title: 'EyeGuardian Started',
                body: 'Notifications are working! You can minimize this app and it will continue monitoring in the background.',
                silent: true
            }).show();
        } catch (err) {
            if (!notificationSetupDialogShown) {
                notificationSetupDialogShown = true;
                showNotificationSetupDialog();
            }
            console.warn('Linux notification test failed, showing setup dialog:', err);
        }
    }
}

function showNotificationSetupDialog() {
    // Create a comprehensive setup dialog showing all platform information
    const setupDialog = new BrowserWindow({
        width: 700,
        height: 650,
        modal: true,
        parent: mainWindow,
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'EyeGuardian Notification Setup',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const platform = process.platform;
    let platformSpecificContent = '';

    if (platform === 'win32') {
        platformSpecificContent = `
            <div class="platform-section active">
                <h3>🪟 Windows Setup</h3>
                <div class="steps">
                    <div class="step" data-number="1">Open Windows Settings (press Windows key + I)</div>
                    <div class="step" data-number="2">Go to System → Notifications & actions</div>
                    <div class="step" data-number="3">Scroll down to find "EyeGuardian"</div>
                    <div class="step" data-number="4">Toggle "Notifications" to ON</div>
                    <div class="step" data-number="5">Optional: Enable "Sound" for audio alerts</div>
                </div>
                <div class="note">
                    <strong>Important:</strong> Ensure "Get notifications from apps and other senders" is turned on in the same settings.
                </div>
            </div>`;
    } else if (platform === 'darwin') {
        platformSpecificContent = `
            <div class="platform-section active">
                <h3>🍎 macOS Setup</h3>
                <div class="steps">
                    <div class="step" data-number="1">Open System Settings (or System Preferences)</div>
                    <div class="step" data-number="2">Go to Notifications & Focus</div>
                    <div class="step" data-number="3">Find "EyeGuardian" in the list</div>
                    <div class="step" data-number="4">Enable "Allow Notifications"</div>
                    <div class="step" data-number="5">Optional: Enable "Sound" for audio alerts</div>
                </div>
                <div class="note">
                    <strong>Tip:</strong> You may see an "Allow" button when EyeGuardian starts. Click it to enable notifications quickly.
                </div>
            </div>`;
    } else if (platform === 'linux') {
        platformSpecificContent = `
            <div class="platform-section active">
                <h3>🐧 Linux Setup</h3>
                <div class="steps">
                    <div class="step" data-number="1">GNOME (Ubuntu, Fedora): Notifications work automatically</div>
                    <div class="step" data-number="2">KDE Plasma: System Settings → Notifications → Enable</div>
                    <div class="step" data-number="3">Other DEs: Ensure notification daemon is running</div>
                </div>
                <div class="note">
                    <strong>Supported daemons:</strong> dunst, notify-osd, xfce4-notifyd, etc. Notifications appear in top-right corner.
                </div>
            </div>`;
    }

    // Create HTML content for the comprehensive setup dialog
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>EyeGuardian Notification Setup</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-width: 600px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                h1 {
                    color: #1f2937;
                    font-size: 24px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .subtitle {
                    color: #6b7280;
                    margin-bottom: 20px;
                    font-size: 14px;
                }
                .emoji {
                    font-size: 32px;
                }
                .platform-section {
                    background: #f8fafc;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .platform-section.active {
                    border-color: #667eea;
                    background: #f0f4ff;
                }
                .platform-section h3 {
                    color: #1f2937;
                    margin-bottom: 15px;
                    font-size: 18px;
                }
                .step {
                    margin: 12px 0;
                    padding-left: 30px;
                    position: relative;
                    color: #374151;
                    line-height: 1.6;
                }
                .step:before {
                    content: attr(data-number);
                    position: absolute;
                    left: 0;
                    top: 0;
                    background: #667eea;
                    color: white;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                }
                .note {
                    background: #fef3c7;
                    border: 1px solid #fcd34d;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 15px;
                    font-size: 13px;
                    color: #92400e;
                    line-height: 1.5;
                }
                .features {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .features h4 {
                    color: #166534;
                    margin-bottom: 10px;
                    font-size: 16px;
                }
                .features ul {
                    color: #14532d;
                    line-height: 1.6;
                    padding-left: 20px;
                }
                .features li {
                    margin: 5px 0;
                }
                .button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    width: 100%;
                    margin-top: 20px;
                    transition: transform 0.2s;
                }
                .button:hover {
                    transform: scale(1.02);
                }
                .button:active {
                    transform: scale(0.98);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1><span class="emoji">🔔</span> EyeGuardian Setup</h1>
                <div class="subtitle">Configure notifications to receive break reminders and eye strain alerts</div>

                <div class="features">
                    <h4>✅ What You'll Get:</h4>
                    <ul>
                        <li>Break reminders every 3-4 minutes when app is minimized</li>
                        <li>Eye strain alerts when health issues are detected</li>
                        <li>System tray notifications with sound</li>
                        <li>Works across all apps (Chrome, VS Code, Word, etc.)</li>
                        <li>Click notifications to open EyeGuardian for details</li>
                    </ul>
                </div>

                ${platformSpecificContent}

                <div class="note">
                    <strong>After setup:</strong> You'll receive notifications in the top-right corner of your screen (or system tray) even when EyeGuardian is minimized. Break reminders appear every 3-4 minutes with helpful suggestions!
                </div>

                <button class="button" onclick="window.close()">Got It - Start Monitoring!</button>
            </div>
            <script>
                document.querySelector('.button').addEventListener('click', () => {
                    window.close();
                });
            </script>
        </body>
        </html>
    `;

    setupDialog.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    setupDialog.once('ready-to-show', () => {
        setupDialog.show();
    });

    setupDialog.on('closed', () => {
        // Dialog closed, continue with app startup
    });
}
function showPermissionDialog(title, message) {
    // Create a modal dialog to inform user about notification permissions
    const permissionDialog = new BrowserWindow({
        width: 600,
        height: 550,
        modal: true,
        parent: mainWindow,
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: title,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Create HTML content for the permission dialog with better formatting
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                    width: 100%;
                }
                h1 {
                    color: #1f2937;
                    font-size: 22px;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .emoji {
                    font-size: 28px;
                }
                .message {
                    color: #4b5563;
                    line-height: 1.8;
                    white-space: pre-line;
                    margin-bottom: 25px;
                    font-size: 14px;
                }
                .step {
                    margin: 12px 0;
                    padding-left: 25px;
                    position: relative;
                    color: #374151;
                    line-height: 1.6;
                }
                .step:before {
                    content: attr(data-number);
                    position: absolute;
                    left: 0;
                    top: 0;
                    background: #667eea;
                    color: white;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                }
                .steps {
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border-left: 4px solid #667eea;
                }
                .note {
                    background: #fef3c7;
                    border: 1px solid #fcd34d;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 15px;
                    font-size: 13px;
                    color: #92400e;
                    line-height: 1.5;
                }
                .button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 600;
                    width: 100%;
                    margin-top: 20px;
                    transition: transform 0.2s;
                }
                .button:hover {
                    transform: scale(1.02);
                }
                .button:active {
                    transform: scale(0.98);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1><span class="emoji">🔔</span> ${title}</h1>
                <div class="message">${message}</div>
                <button class="button" onclick="window.close()">Got It!</button>
            </div>
            <script>
                document.querySelector('.button').addEventListener('click', () => {
                    window.close();
                });
            </script>
        </body>
        </html>
    `;

    permissionDialog.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    permissionDialog.once('ready-to-show', () => {
        permissionDialog.show();
    });

    permissionDialog.on('closed', () => {
        // Dialog closed, continue with app startup
    });
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

    // Setup system startup management
    setupSystemStartup();

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

    // Cross-platform notification permission check
    checkNotificationPermissions();

    ipcMain.on('notify', (event, { title, body }) => {
        new Notification({ title, body }).show();
    });

    // IPC handler for checking notification permissions from renderer
    ipcMain.handle('check-notification-permissions', async () => {
        if (!Notification.isSupported()) {
            return { supported: false, granted: false };
        }

        // For all platforms including macOS, Windows, and Linux running in Node.js
        // via Electron Main Process, there's no direct web requestPermission API.
        return { supported: true, granted: true }; // Assume granted if supported
    });

    // IPC handlers for background sound notifications
    ipcMain.on('play-sound', (event, soundType) => {
        playSound(soundType);
    });

    // Individual sound handlers for specific alerts
    ipcMain.on('play-high-strain-sound', () => playSound('highStrain'));
    ipcMain.on('play-break-reminder-sound', () => playSound('breakReminder'));
    ipcMain.on('play-posture-alert-sound', () => playSound('postureAlert'));
    ipcMain.on('play-blink-alert-sound', () => playSound('blinkAlert'));
    ipcMain.on('play-redness-alert-sound', () => playSound('rednessAlert'));
    ipcMain.on('play-lighting-alert-sound', () => playSound('lightingAlert'));
    ipcMain.on('play-distance-alert-sound', () => playSound('distanceAlert'));
    ipcMain.on('play-multiple-issues-sound', () => playSound('multipleIssues'));

    // IPC handlers for system startup management
    ipcMain.handle('get-auto-start-status', () => autoStartEnabled);
    ipcMain.handle('set-auto-start', async (event, enabled) => {
        return setSystemStartup(enabled);
    });

    // IPC handlers for background monitoring preference
    ipcMain.handle('get-background-monitoring', () => backgroundMonitoringEnabled);
    ipcMain.handle('set-background-monitoring', (event, enabled) => {
        backgroundMonitoringEnabled = enabled;
        console.log(`Background monitoring ${enabled ? 'enabled' : 'disabled'}`);
        
        if (enabled && mainWindow && !mainWindow.isVisible()) {
            // If enabling and window is hidden, start monitoring now
            startBackgroundMonitoring();
        } else if (!enabled) {
            // If disabling, stop monitoring
            stopBackgroundMonitoring();
        }
        
        return true;
    });

    // IPC handler to start break mode (hides UI and shows a full-screen break timer)
    ipcMain.on('start-break-mode', () => {
        createBreakWindow();
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
