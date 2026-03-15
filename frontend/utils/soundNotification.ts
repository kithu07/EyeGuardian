// Cross-platform sound notifications using Electron IPC
// Audio only plays when app is in focus (not in background)

let appIsVisible = true;

// Listen for app visibility changes
if (typeof window !== 'undefined' && window.electronAPI?.onAppVisibilityChange) {
    window.electronAPI.onAppVisibilityChange((isVisible: boolean) => {
        appIsVisible = isVisible;
        console.log('App visibility changed:', isVisible);
    });
}

function canPlaySound(): boolean {
    // Only play sounds when app is visible/focused
    return appIsVisible;
}

export function playTone(frequency: number, duration = 0.3) {
    // Legacy function - now uses IPC for cross-platform audio
    console.warn('playTone() is deprecated. Use specific sound functions instead.');
}

export function playHighStrainSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playHighStrainSound) {
        window.electronAPI.playHighStrainSound();
    } else {
        console.log('High strain sound (fallback - no audio in browser mode)');
    }
}

export function playBreakReminderSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playBreakReminderSound) {
        window.electronAPI.playBreakReminderSound();
    } else {
        console.log('Break reminder sound (fallback - no audio in browser mode)');
    }
}

export function playPostureAlertSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playPostureAlertSound) {
        window.electronAPI.playPostureAlertSound();
    } else {
        console.log('Posture alert sound (fallback - no audio in browser mode)');
    }
}

export function playBlinkAlertSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playBlinkAlertSound) {
        window.electronAPI.playBlinkAlertSound();
    } else {
        console.log('Blink alert sound (fallback - no audio in browser mode)');
    }
}

export function playRednessAlertSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playRednessAlertSound) {
        window.electronAPI.playRednessAlertSound();
    } else {
        console.log('Redness alert sound (fallback - no audio in browser mode)');
    }
}

export function playLightingAlertSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playLightingAlertSound) {
        window.electronAPI.playLightingAlertSound();
    } else {
        console.log('Lighting alert sound (fallback - no audio in browser mode)');
    }
}

export function playDistanceAlertSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playDistanceAlertSound) {
        window.electronAPI.playDistanceAlertSound();
    } else {
        console.log('Distance alert sound (fallback - no audio in browser mode)');
    }
}

export function playMultipleIssuesSound() {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playMultipleIssuesSound) {
        window.electronAPI.playMultipleIssuesSound();
    } else {
        console.log('Multiple issues sound (fallback - no audio in browser mode)');
    }
}

// Generic sound player for custom sound types
export function playSound(soundType: string) {
    if (!canPlaySound()) {
        console.debug('Sound skipped: app not in focus');
        return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.playSound) {
        window.electronAPI.playSound(soundType);
    } else {
        console.log(`Sound: ${soundType} (fallback - no audio in browser mode)`);
    }
}
