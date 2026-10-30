// 소리는 녹음 파일 없이 Web Audio로 합성한다: 목탁, 싱잉볼(풍경), 동전, 바람, 법당 음악 다섯 곡
let ctx = null, master = null, ambient = null;
export const sound = { on: false };

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.4;   // 전체 소리는 은은하게
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSound(on) {
  sound.on = on;
  if (on) { ensure(); startAmbient(); } else stopAmbient();
  setMusic(musicId);
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
  const g = ctx.createGain(); g.gain.value = 0.07;
  src.connect(f).connect(g).connect(master); src.start();
  ambient = { src, g };
}
function stopAmbient() { try { ambient?.src.stop(); } catch {} ambient = null; }

// ───────── 법당 음악 다섯 곡 ─────────
// 녹음 파일 없이 여기서 합성해요 (저작권 걱정 없는 소리). 가락은 모두 이 사이트에서 새로 지었어요.
// 곡마다 step(st, at, out) 이 한 박을 out 에 예약하고 다음 박까지 남은 초를 돌려줘요.
export const TRACKS = [
  { id: 'yeombul', name: '나무아미타불', cap: '목탁에 맞춘 염불 가락' },
  { id: 'banya', name: '반야심경 독경', cap: '목탁 박자로 읊는 경' },
  { id: 'jong', name: '범종', cap: '길게 울리는 새벽 범종' },
  { id: 'bowl', name: '싱잉볼 명상', cap: '천천히 울리는 싱잉볼' },
  { id: 'wind', name: '산사 풍경', cap: '바람과 처마 끝 풍경' },
];

// 사람 목소리 비슷하게: 톱니파를 모음 소리 대역(포먼트)으로 거른다
const FORMANT = { a: [730, 1090, 2440], e: [530, 1840, 2480], eo: [600, 1000, 2400], o: [450, 800, 2830], u: [320, 800, 2240], eu: [350, 1400, 2400], i: [280, 2250, 2900] };
// 한글 중성 21자 → 위 모음
const JUNG = ['a', 'e', 'a', 'e', 'eo', 'e', 'eo', 'e', 'o', 'a', 'e', 'e', 'o', 'u', 'eo', 'e', 'i', 'u', 'eu', 'i', 'i'];
const vowelOf = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? JUNG[Math.floor((c % 588) / 28)] : 'a'; };

function voice(at, freq, dur, v, gain, out, glide = 1) {
  const c = out.context;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, at);
  if (glide !== 1) o.frequency.linearRampToValueAtTime(freq * glide, at + dur);
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 5; lg.gain.value = freq * 0.006;
  lfo.connect(lg).connect(o.frequency);
  const sum = c.createGain(), env = c.createGain();
  for (const [f, q, g] of FORMANT[v].map((f, i) => [f, [5, 8, 10][i], [1.6, 0.8, 0.3][i]])) {
    const b = c.createBiquadFilter(), bg = c.createGain();
    b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; bg.gain.value = g;
    o.connect(b).connect(bg).connect(sum);
  }
  const lp = c.createBiquadFilter(), lpg = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 350; lpg.gain.value = 0.25;
  o.connect(lp).connect(lpg).connect(sum);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.05);
  env.gain.setValueAtTime(gain, at + dur * 0.7);
  env.gain.linearRampToValueAtTime(0, at + dur);
  sum.connect(env).connect(out);
  o.start(at); lfo.start(at); o.stop(at + dur + 0.05); lfo.stop(at + dur + 0.05);
}

// 울림 하나: [배수, 세기, 길이] 여러 개를 겹친다
function ring(at, base, parts, gain, out, attack = 0.004) {
  const c = out.context;
  for (const [m, g, d] of parts) {
    const o = c.createOscillator(), e = c.createGain();
    o.frequency.value = base * m;
    e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(g * gain, at + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(e).connect(out);
    o.start(at); o.stop(at + d + 0.05);
  }
}

const hit = (at, vol, out) => ring(at, 520, [[1, 0.5, 0.18], [2, 0.15, 0.08], [0.5, 0.2, 0.12]], vol, out, 0.002);

function noiseBuf(c, sec) {
  const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
  return b;
}

// 나무아미타불: 여섯 글자 + 두 박 쉼, 박마다 목탁
const NAMU = [['a', 0], ['u', 0], ['a', 3], ['i', 3], ['a', 2], ['u', 0]];
// 반야심경 앞부분 (경전 원문은 저작권이 없어요). 띄어쓰기마다 숨을 쉰다
const BANYA = '마하반야바라밀다심경 관자재보살 행심반야바라밀다시 조견오온개공 도일체고액 사리자 색불이공 공불이색 색즉시공 공즉시색 수상행식 역부여시';

// 범종 울림. 1과 1.004 가 겹쳐 '맥놀이'로 웅웅 울려요
const JONG = [[0.5, 0.5, 26], [1, 0.45, 20], [1.004, 0.4, 20], [1.19, 0.18, 12], [1.51, 0.14, 9], [2, 0.16, 8], [2.52, 0.08, 6], [2.68, 0.06, 5], [3.01, 0.05, 4]];

const STEPS = {
  yeombul(st, at, out) {
    const k = (st.i = (st.i ?? -1) + 1) % 8;
    hit(at, k === 0 ? 1 : 0.75, out);
    if (k < 6) { const [v, s] = NAMU[k]; voice(at + 0.02, 123 * 2 ** (s / 12), k === 5 ? 1.2 : 0.58, v, 0.5, out, k === 5 ? 0.96 : 1); }
    return 0.62;
  },
  banya(st, at, out) {
    st.i = ((st.i ?? -1) + 1) % BANYA.length;
    const ch = BANYA[st.i], end = BANYA[st.i + 1] === ' ' || st.i === BANYA.length - 1;
    if (ch === ' ') return 0.34;
    hit(at, 0.6, out);
    voice(at + 0.02, 118, end ? 0.62 : 0.31, vowelOf(ch), 0.6, out, end ? 0.94 : 1);
    return end ? 0.68 : 0.34;
  },
  jong(st, at, out) {
    // 처음 한 번은 바로, 그다음부터 14초마다
    ring(at, 128, JONG, 0.7, out, 0.01);
    return 14;
  },
  bowl(st, at, out) {
    const base = [196, 220, 261.6, 293.7][Math.floor(Math.random() * 4)];
    ring(at, base, [[1, 0.3, 9], [1.008, 0.25, 9], [2.71, 0.08, 5], [5.1, 0.03, 2.5], [0.5, 0.1, 7]], 1.3, out, 0.03);
    return 7 + Math.random() * 4;
  },
  wind(st, at, out) {
    if (!st.wind) {
      const c = out.context, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      const lfo = c.createOscillator(), lg = c.createGain();
      src.buffer = noiseBuf(c, 4); src.loop = true;
      f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
      g.gain.value = 0.4; lfo.frequency.value = 0.07; lg.gain.value = 0.25;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(out);
      src.start(at); lfo.start(at);
      st.wind = [src, lfo];
    }
    // 풍경: 한 번에 1~3번 땡그랑
    const n = 1 + Math.floor(Math.random() * 3), base = 1500 * (0.97 + Math.random() * 0.06);
    for (let k = 0; k < n; k++) ring(at + k * (0.18 + Math.random() * 0.25), base, [[1, 0.2, 2.6], [2.76, 0.06, 1.2], [5.4, 0.02, 0.6]], 1.5 - k * 0.35, out, 0.002);
    return 3 + Math.random() * 5;
  },
};

// 모든 곡에 같이 거는 법당 잔향
function reverb(c) {
  const len = c.sampleRate * 3, b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  const cv = c.createConvolver(); cv.buffer = b;
  return cv;
}

// 곡 하나를 out 에 틀고, 멈추는 함수를 돌려준다. 0.6초 앞까지 미리 예약해 두고 0.1초마다 채운다
export function playTrack(id, out, { from = out.context.currentTime + 0.1, until = Infinity } = {}) {
  const c = out.context, step = STEPS[id], st = {};
  const bus = c.createGain(), wet = c.createGain(), cv = reverb(c);
  bus.gain.value = 1; wet.gain.value = 0.35;
  bus.connect(out); bus.connect(cv).connect(wet).connect(out);
  let next = from;
  const fill = (to) => { while (next < Math.min(to, until)) next += step(st, next, bus); };
  if (until !== Infinity) { fill(until); return () => {}; }   // 미리 듣기용 (한 번에 다 예약)
  fill(c.currentTime + 0.6);
  const timer = setInterval(() => fill(c.currentTime + 0.6), 100);
  return () => {
    clearInterval(timer);
    const t = c.currentTime;
    bus.gain.setTargetAtTime(0, t, 0.3); wet.gain.setTargetAtTime(0, t, 0.3);
    setTimeout(() => { st.wind?.forEach((n) => { try { n.stop(); } catch {} }); bus.disconnect(); wet.disconnect(); }, 2000);
  };
}

let musicId = null, stopMusic = null, musicGain = null;
export function setMusic(id) {
  musicId = TRACKS.some((t) => t.id === id) ? id : null;
  stopMusic?.(); stopMusic = null;
  if (!sound.on || !musicId) return;
  ensure();
  if (!musicGain) { musicGain = ctx.createGain(); musicGain.gain.value = 0.6; musicGain.connect(master); }
  stopMusic = playTrack(musicId, musicGain);
}
export const music = () => musicId;

// 정각 범종: 음악과 따로, 조금 낮은 대종 소리로 한 번
export function bigBell() {
  if (!sound.on) return;
  ensure();
  ring(ctx.currentTime + 0.05, 96, JONG, 0.9, master, 0.01);
}
