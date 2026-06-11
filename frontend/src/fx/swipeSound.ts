// Tiny Web Audio synth for swipe feedback — no audio files, nothing to load.
// Every sound is built from oscillators/filtered noise at call time. The
// AudioContext is created lazily inside the first swipe (a user gesture), so
// autoplay policies are satisfied; everything no-ops where audio is missing
// (tests, very old browsers).

export type SoundAction = 'keep' | 'pass' | 'favorite';

const VOLUME = 0.16; // master — present but polite

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// 0.5s of cached white noise, the raw material for the whoosh.
function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// One enveloped oscillator note (freq glides `from` → `to`).
function note(
  ac: AudioContext,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    at: number; // start (s, absolute)
    dur: number;
    peak: number; // gain at attack
  },
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, opts.at);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, opts.at + opts.dur);
  gain.gain.setValueAtTime(0.0001, opts.at);
  gain.gain.exponentialRampToValueAtTime(opts.peak * VOLUME, opts.at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(opts.at);
  osc.stop(opts.at + opts.dur + 0.02);
}

export function playSwipeSound(action: SoundAction): void {
  const ac = audio();
  if (!ac || document.visibilityState === 'hidden') return;
  const t = ac.currentTime;
  try {
    if (action === 'pass') {
      // Dry "whoosh" — bandpass-filtered noise sweeping down and away.
      const src = ac.createBufferSource();
      src.buffer = noise(ac);
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(950, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.28);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9 * VOLUME, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      src.connect(filter).connect(gain).connect(ac.destination);
      src.start(t);
      src.stop(t + 0.32);
    } else if (action === 'keep') {
      // Upbeat "pop-ding" — a rising blip with a bright harmonic on top.
      note(ac, { type: 'triangle', from: 392, to: 587, at: t, dur: 0.14, peak: 0.9 });
      note(ac, { type: 'sine', from: 1175, at: t + 0.06, dur: 0.18, peak: 0.5 });
    } else {
      // Star sparkle — a quick ascending major arpeggio.
      note(ac, { type: 'sine', from: 1047, at: t, dur: 0.12, peak: 0.55 }); // C6
      note(ac, { type: 'sine', from: 1319, at: t + 0.055, dur: 0.12, peak: 0.5 }); // E6
      note(ac, { type: 'sine', from: 1568, at: t + 0.11, dur: 0.16, peak: 0.45 }); // G6
    }
  } catch {
    /* a dropped sound is never worth an error */
  }
}
