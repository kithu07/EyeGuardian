This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Notification Permissions

EyeGuardian requires notification permissions to alert you about eye strain, break reminders, and health issues. The app will automatically check permissions on startup and show guidance if needed.

### macOS
1. Go to **System Settings** > **Notifications & Focus**
2. Find **EyeGuardian** in the list
3. Enable **Allow Notifications**
4. Optionally enable **Allow Notifications When the Display is Sleeping** for background alerts

### Windows
1. Click the **Windows Start button**
2. Search for **"Notifications & actions settings"**
3. Scroll down to find **EyeGuardian**
4. Turn on notifications for EyeGuardian
5. Check **"Get notifications from apps and other senders"** if needed

### Linux
Notification support depends on your desktop environment:

- **GNOME**: Notifications should work automatically
- **KDE Plasma**: Go to **System Settings** > **Notifications**
- **Other DEs**: Ensure your notification daemon is running (usually `dunst`, `notify-osd`, or similar)

If notifications don't appear, check that your desktop environment supports the Freedesktop notification specification.

## System Startup

EyeGuardian can automatically start when your system boots:

### Windows
- Open the Settings app and go to the startup section
- Or use the in-app Settings to enable "Start on System Boot"

### macOS
- The app creates a Launch Agent in `~/Library/LaunchAgents/`
- Can be enabled/disabled via the Settings panel

### Linux
- Creates a desktop entry in `~/.config/autostart/`
- Compatible with most desktop environments (GNOME, KDE, etc.)

## Settings

Access the Settings panel by clicking the "Settings" button in the top-right corner:

- **System Integration**: Enable/disable automatic startup on system boot
- **Monitoring**: Control background monitoring when the app is minimized
- **Audio**: Adjust alert volume and test sounds
- **Notifications**: View notification permission status

## Tray Icon Indicators

The system tray icon changes color based on your eye health status:
- 🟢 **Green**: Good eye health
- 🟡 **Yellow**: Warning - some issues detected
- 🔴 **Red**: Critical - immediate attention needed

## Background Monitoring

When minimized or running in the background, EyeGuardian continues monitoring your eye health and will:
- Show **system notifications** with **audio alerts** (native OS sounds)
- Update the tray icon status (🟢🟡🔴)
- Maintain WebSocket connection to the backend
- Work across all apps and windows
- **Show break reminders every 60 minutes** even if you're working in another app

**Alert Throttling:**
- **Health alerts**: Maximum one alert every **3 minutes**
- **Same alert type**: Maximum once every **4 minutes** per alert type
- **Break reminders**: Every **60 minutes** with rotating helpful suggestions
- **Why throttling?**: Prevents notification spam while maintaining eye health monitoring

**Break Reminder Features:**
- Appears **on your system tray** no matter what application you're using
- Random helpful suggestions: "Look away for 20 seconds", "Stand up and walk", "Stretch your neck", etc.
- **Clickable** - click to open EyeGuardian for detailed health recommendations
- Plays **audio alert** with reminder sound

**Audio in Background:**
- Plays **native system notification sounds** that work across Windows/macOS/Linux
- No external media player windows are opened
- Sounds are system-level (Glass.aiff on macOS, Windows notification sound, freedesktop sound on Linux)
- **Works even when app is minimized or another app is open** ✅

**Audio Alerts When App is In Focus:**
- When the app window is open and active, audio alerts through Web Audio API
- Can be controlled via Settings volume slider
- Only plays when you're actively using the app

## Notification Types

1. **High Strain Alert** (🚨): Eye strain exceeds 80%
2. **Break Reminder** (⏰): Time to take a rest break
3. **Posture Alert** (📍): Poor sitting posture detected
4. **Blink Reminder** (👁️): Blink rate too low
5. **Eye Redness** (🔴): Red eyes detected
6. **Lighting Alert** (💡): Poor lighting conditions
7. **Screen Distance** (📺): Sitting too close to screen
8. **Multiple Issues** (⚠️): Multiple health problems detected simultaneously

## Sound Files

Sound files are located in `electron/sounds/` and can be replaced with your preferred audio files (must be .wav format).

**Background Monitoring Audio:**
- Uses native system sounds (no custom WAV files needed in background mode)
- Works reliably across all platforms
- No permission issues since it's OS-level audio

**In-App Audio (when window is active):**
- Custom .wav files from `electron/sounds/` directory
- Controlled via Settings volume slider
- Web Audio API for seamless playback
