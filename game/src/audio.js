// Original sound, synthesised live with the Web Audio API — no audio files.
// A soft pentatonic pluck for moths, a low thud for wisp hits, a warm chime for
// a new night, a shimmer for the pulse, and a gentle rising arpeggio for the win.
// Nothing plays until the player first interacts, so browsers never block it.

const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(frequency, seconds, type, volume, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  return {
    /** Call from the first key or pointer press; unlocks audio for the session. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    moth(combo) {
      const note = NOTES[Math.min(combo - 1, NOTES.length - 1)];
      tone(note, 0.35, 'sine', 0.5);
      tone(note * 2, 0.22, 'triangle', 0.18);
    },
    pulse() {
      tone(660, 0.3, 'sine', 0.25, 0, 990);
      tone(330, 0.25, 'triangle', 0.15, 0, 520);
    },
    hurt() {
      tone(160, 0.4, 'sawtooth', 0.3, 0, 70);
      tone(90, 0.35, 'square', 0.18, 0.02, 55);
    },
    wispRepelled() {
      tone(420, 0.18, 'sine', 0.2, 0, 180);
    },
    dewdrop() {
      tone(1046.5, 0.3, 'sine', 0.35);
      tone(1318.5, 0.4, 'sine', 0.3, 0.08);
    },
    night() {
      tone(392, 0.5, 'triangle', 0.3);
      tone(523.25, 0.5, 'triangle', 0.3, 0.12);
      tone(783.99, 0.7, 'sine', 0.28, 0.24);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((note, i) => tone(note, 0.6, 'triangle', 0.32, i * 0.13));
    },
    lose() {
      [392, 329.63, 261.63, 196].forEach((note, i) => tone(note, 0.55, 'sine', 0.28, i * 0.16));
    },
  };
}
