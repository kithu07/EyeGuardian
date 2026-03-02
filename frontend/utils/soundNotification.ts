// Simple tone generator using Web Audio API
// Caller can specify frequency and duration for different alerts

let audioContext: AudioContext | null = null;

function getContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

export function playTone(frequency: number, duration = 0.3) {
    try {
        const ctx = getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequency;
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration + 0.05);
    } catch (e) {
        console.warn('Audio API unavailable', e);
    }
}

export function playHighStrainSound() {
    // two descending beeps
    playTone(880, 0.2);
    setTimeout(() => playTone(440, 0.2), 250);
}

export function playBreakReminderSound() {
    // single pleasant chime
    playTone(660, 0.4);
}
