// Sons synthétisés avec WebAudio : aucun fichier audio, donc rien à télécharger hors ligne.

let ctx = null;
let enabled = true;

function audio() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone({ freq, to, type = 'sine', dur = 0.15, gain = 0.12, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, gain = 0.2, filter = 'lowpass', freq = 1200, to, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
}

export const sound = {
  get enabled() { return enabled; },
  setEnabled(on) { enabled = !!on; },
  /** À appeler sur un geste de l'utilisateur : iOS n'autorise le son qu'ensuite. */
  unlock() { audio(); },
  tap() { tone({ freq: 520, to: 660, dur: 0.06, gain: 0.05, type: 'triangle' }); },
  select() { tone({ freq: 440, to: 880, dur: 0.09, gain: 0.07, type: 'triangle' }); },
  flip() { noise({ dur: 0.09, gain: 0.08, filter: 'bandpass', freq: 2400, to: 900 }); },
  shuffle() { for (let i = 0; i < 5; i++) noise({ dur: 0.05, gain: 0.07, filter: 'bandpass', freq: 1800 + i * 300, delay: i * 0.07 }); },
  snip() {
    noise({ dur: 0.05, gain: 0.25, filter: 'highpass', freq: 3200 });
    tone({ freq: 1800, to: 500, dur: 0.07, gain: 0.08, type: 'square', delay: 0.02 });
  },
  inert() { tone({ freq: 220, to: 150, dur: 0.22, gain: 0.1, type: 'sine' }); },
  bypass() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, gain: 0.09, type: 'triangle', delay: i * 0.08 })); },
  overload() {
    noise({ dur: 1.4, gain: 0.5, filter: 'lowpass', freq: 2600, to: 60 });
    tone({ freq: 140, to: 30, dur: 1.2, gain: 0.3, type: 'sawtooth' });
    noise({ dur: 0.12, gain: 0.4, filter: 'highpass', freq: 4000 });
  },
  win() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.08, type: 'sine', delay: i * 0.12 })); },
  solo() { [311, 466, 622, 932].forEach((f, i) => tone({ freq: f, dur: 0.7, gain: 0.08, type: 'sawtooth', delay: i * 0.14 })); },
  timeout() { [330, 277, 220, 165].forEach((f, i) => tone({ freq: f, dur: 0.4, gain: 0.1, type: 'triangle', delay: i * 0.22 })); },
  error() { tone({ freq: 160, dur: 0.12, gain: 0.08, type: 'square' }); },
};
