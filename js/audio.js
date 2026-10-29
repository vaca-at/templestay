// 소리는 녹음 파일 없이 Web Audio로 합성한다: 목탁, 싱잉볼(풍경), 동전, 바람
let ctx = null, master = null, ambient = null;
export const sound = { on: false };

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSound(on) {
  sound.on = on;
  if (on) { ensure(); startAmbient(); } else stopAmbient();
}

function tone(freq, dur, { type = 'sine', gain = 0.3, attack = 0.005, at = 0 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export function moktak(vol = 1) {
  if (!sound.on) return;
  ensure();
  tone(520, 0.18, { gain: 0.5 * vol, attack: 0.002 });
  tone(1040, 0.08, { gain: 0.15 * vol, attack: 0.001 });
  tone(260, 0.12, { type: 'triangle', gain: 0.2 * vol, attack: 0.002 });
}

export function bowl(vol = 1) {
  if (!sound.on) return;
  ensure();
  for (const [f, g, d] of [[220, 0.22, 6], [221.5, 0.18, 6], [596, 0.08, 4], [1150, 0.04, 2.5]]) tone(f, d, { gain: g * vol, attack: 0.02 });
}

export function coin() {
  if (!sound.on) return;
  ensure();
  [0, 0.09, 0.2].forEach((at, i) => tone(1800 + i * 300, 0.35, { gain: 0.12, at, type: 'triangle' }));
}

function startAmbient() {
  if (ambient || !ctx) return;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ctx.createGain(); g.gain.value = 0.12;
  src.connect(f).connect(g).connect(master); src.start();
  ambient = { src, g };
}
function stopAmbient() { try { ambient?.src.stop(); } catch {} ambient = null; }
