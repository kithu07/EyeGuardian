let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let soundBuffer: AudioBuffer | null = null;
let initialized = false;

// Initialize the Web Audio player with a sound file URL
export async function initAlertSound(url: string, volume = 0.7) {
  if (initialized) return;

  try {
    const windowWithAudio = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AudioCtxCtor = windowWithAudio.AudioContext ?? windowWithAudio.webkitAudioContext;
    if (!AudioCtxCtor) {
      throw new Error('Web Audio API not supported');
    }
    audioCtx = new AudioCtxCtor();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = Math.max(0, Math.min(1, volume));
    masterGain.connect(audioCtx.destination);

    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    soundBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Some browsers require a user gesture to start audio; resume if suspended.
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    initialized = true;
  } catch (e) {
    console.warn('Failed to initialize alert sound:', e);
  }
}

export function setAlertVolume(percent: number) {
  if (!masterGain) return;
  const value = Math.max(0, Math.min(1, percent / 100));
  masterGain.gain.value = value;
}

export function playAlertSound() {
  if (!initialized || !audioCtx || !soundBuffer || !masterGain) return;

  try {
    const source = audioCtx.createBufferSource();
    source.buffer = soundBuffer;
    source.connect(masterGain);
    source.start();
  } catch (e) {
    console.warn('Failed to play alert sound:', e);
  }
}
