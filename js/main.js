// 앱 흐름: 첫 화면 → 캐릭터 꾸미기 → 법당 위치 → (자동 서버 배정) → 법당 밖 마당 ↔ 법당 안
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LOCATIONS, CHAR_TYPES, OUTFITS, ACCESSORIES, SKIN_TONES, ACTIONS, SERVER_COUNT, SERVER_CAP, randomName, defaultLook } from './data.js';
import { Avatar } from './avatar.js';
import { buildInterior, buildExterior, buildLantern, paintView } from './world.js';
import { Net, preloadNet } from './net.js';
import { setSound, sound, moktak, bowl, coin } from './audio.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem('maeum:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('maeum:' + k, JSON.stringify(v)); } catch {} },
};
const fmtTime = (sec) => {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};
const fmtLong = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${m}분`;
};

// ───────── 렌더러 ─────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.5;
const players = new THREE.Group();
scene.add(players);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ───────── 상태 ─────────
const S = {
  profile: store.get('profile', null),
  guest: false,
  loc: null,
  server: 0,
  scene: 'out',
  worlds: {},
  active: null,
  me: null,
  seat: null,
  target: null,
  remotes: new Map(),
  wishes: [],
  lanterns: new Map(),
  enteredAt: 0,
  camAnim: null,
  mode: 'intro', // intro | world | gallery
};

const net = new Net({
  onCounts: () => { renderServerGrid(); updateHud(); },
  onState: handleRemoteState,
  onAct: (peer, d) => {
    const r = S.remotes.get(peer);
    const def = ACTIONS.find((a) => a.id === d.a);
    if (r && def && d.on !== false) toast(`${r.st.n}님이 ${def.verb}`);
  },
  onWish: (peer, w, backlog) => addWish(w, { animate: !backlog, announce: !backlog }),
  onLeave: (peer) => removeRemote(peer, true),
  onReset: () => { for (const id of [...S.remotes.keys()]) removeRemote(id, false); },
  getWishes: () => S.wishes,
});

// ───────── 월드 ─────────
function worldFor(locId, which) {
  const w = (S.worlds[locId] ||= {});
  if (!w[which]) {
    const loc = LOCATIONS.find((l) => l.id === locId);
    w[which] = which === 'in' ? buildInterior(loc) : buildExterior(loc);
    if (which === 'in') tryLoadBuddha(w[which]);
  }
  return w[which];
}

// 실제 불상 3D 스캔(assets/buddha.glb)이 있으면 절차적으로 만든 불상 대신 쓴다
let buddhaGLB = null;
async function tryLoadBuddha(world) {
  try {
    if (!buddhaGLB) {
      const head = await fetch('assets/buddha.glb', { method: 'HEAD' });
      if (!head.ok) return;
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      buddhaGLB = loader.loadAsync('assets/buddha.glb');
    }
    const gltf = await buddhaGLB;
    const model = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = 4.6 / size.y;
    model.scale.setScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    world.buddhaSlot.clear();
    world.buddhaSlot.add(model);
    world.buddhaSlot.userData.scan = true;
  } catch (e) { console.warn('불상 모델을 불러오지 못해 기본 불상을 써요', e); }
}

function setWorld(world) {
  if (S.active) scene.remove(S.active.group);
  S.active = world;
  scene.add(world.group);
  scene.fog = world.fog;
  scene.background = world.background;
}

// ───────── 내 캐릭터 ─────────
function makeMe() {
  if (S.me) { players.remove(S.me.group); S.me.dispose(); }
  const p = S.profile || { name: '둘러보는 분', look: defaultLook() };
  S.me = new Avatar(p.look, p.name, { mine: true });
  S.me.group.visible = !S.guest;
  S.me.onBow = (n) => {
    $('#bae-counter').innerHTML = `<small>108배</small><b>${n}</b><small>/ 108</small>`;
    if (n >= 108) { bowl(); toast('108배를 모두 마쳤어요'); setTimeout(() => ($('#bae-counter').hidden = true), 2500); }
  };
  players.add(S.me.group);
}

// ───────── 장면 전환 (안/밖) ─────────
const fade = (on) => new Promise((r) => { $('#fade').classList.toggle('on', on); setTimeout(r, on ? 460 : 10); });

async function goScene(which, { intro = false, instant = false } = {}) {
  if (!instant) await fade(true);
  standUp(true);
  S.scene = which;
  const world = worldFor(S.loc.id, which);
  setWorld(world);
  if (which === 'in') rebuildLanterns();
  const me = S.me.group;
  if (which === 'in') {
    me.position.copy(world.spawn);
    me.rotation.y = world.spawnRot;
    controls.minDistance = 2.2; controls.maxDistance = 13;
  } else {
    me.position.copy(world.door).add(new THREE.Vector3(0, 0, 2.6));
    me.rotation.y = 0;
    if (intro) me.position.copy(world.spawn), (me.rotation.y = world.spawnRot);
    controls.minDistance = 2.5; controls.maxDistance = 38;
  }
  S.target = null;
  placeCameraBehind(which === 'in' ? 5 : 8);
  if (intro && which === 'out') startIntroSwoop();
  refreshRemoteVisibility();
  updateHud();
  pushState(true);
  if (!instant) fade(false);
}

function placeCameraBehind(dist) {
  const me = S.me.group;
  const back = new THREE.Vector3(Math.sin(me.rotation.y), 0, Math.cos(me.rotation.y)).multiplyScalar(-dist);
  controls.target.copy(me.position).add(new THREE.Vector3(0, 1.1, 0));
  camera.position.copy(controls.target).add(back).add(new THREE.Vector3(0, dist * 0.42, 0));
  controls.update();
}

// 처음 도착하면 경치를 먼저 보여주고 캐릭터 뒤로 카메라가 내려온다
function startIntroSwoop() {
  const toPos = camera.position.clone(), toTarget = controls.target.clone();
  S.camAnim = {
    t: 0, dur: 4.2,
    fromPos: new THREE.Vector3(-6, 9, -4), fromTarget: new THREE.Vector3(0, -6, 60),
    toPos, toTarget,
  };
}

// ───────── 원격 캐릭터 ─────────
function handleRemoteState(peer, d) {
  if (!d || !d.l || !d.n) return;
  let r = S.remotes.get(peer);
  if (!r) {
    const av = new Avatar(d.l, d.n);
    players.add(av.group);
    av.group.position.set(d.p[0], 0, d.p[1]);
    av.group.rotation.y = d.r;
    r = { av, st: d, pos: new THREE.Vector3(d.p[0], 0, d.p[1]), rot: d.r, appliedA: null, lookKey: JSON.stringify(d.l), seen: 0 };
    S.remotes.set(peer, r);
    toast(`${d.n}님이 ${S.loc ? S.loc.name : '법당'}에 오셨어요`);
  }
  const lookKey = JSON.stringify(d.l);
  if (lookKey !== r.lookKey) { r.av.build(d.l); r.lookKey = lookKey; }
  if (d.n !== r.st.n) r.av.setName(d.n);
  if (d.s !== r.st.s) { r.av.group.position.set(d.p[0], 0, d.p[1]); }
  r.st = d;
  r.seen = performance.now();
  r.pos.set(d.p[0], 0, d.p[1]);
  r.rot = d.r;
  r.av.seated = d.seat != null;
  if (d.a !== r.appliedA) {
    r.appliedA = d.a;
    if (d.a) { r.av.action = d.a; r.av.actionT = d.at || 0; r.av.bowCount = 0; }
    else if (ACTIONS.find((a) => a.id === r.av.action)?.loop) r.av.stop();
  }
  r.av.group.visible = d.s === S.scene;
  updateHud();
}

function removeRemote(peer, announce) {
  const r = S.remotes.get(peer);
  if (!r) return;
  players.remove(r.av.group);
  r.av.dispose();
  S.remotes.delete(peer);
  if (announce) toast(`${r.st.n}님이 법당을 나섰어요`);
  updateHud();
}

function refreshRemoteVisibility() {
  for (const r of S.remotes.values()) r.av.group.visible = r.st.s === S.scene;
}

function seatTaken(id) {
  for (const r of S.remotes.values()) if (r.st.s === 'in' && r.st.seat === id) return true;
  return false;
}

// ───────── 상태 전송 ─────────
let lastSent = '', lastSentAt = 0;
function pushState(force = false) {
  if (!S.me || S.guest || S.mode !== 'world') return;
  const g = S.me.group;
  const st = {
    n: S.profile.name, l: S.profile.look, s: S.scene,
    p: [Math.round(g.position.x * 100) / 100, Math.round(g.position.z * 100) / 100],
    r: Math.round(g.rotation.y * 100) / 100,
    seat: S.seat, a: S.me.action, at: S.me.action ? Math.round(S.me.actionT * 10) / 10 : 0,
  };
  const key = JSON.stringify({ ...st, at: 0 });
  const now = performance.now();
  if (force || (key !== lastSent && now - lastSentAt > 90) || now - lastSentAt > 3000) {
    lastSent = key; lastSentAt = now;
    net.sendState(st);
  }
}

// ───────── 앉기 / 일어서기 ─────────
function sitOn(cushion) {
  if (S.guest) return toast('캐릭터를 만들면 방석에 앉을 수 있어요');
  if (seatTaken(cushion.id)) return toast('다른 분이 앉아 계신 자리예요');
  S.seat = cushion.id;
  S.target = null;
  const g = S.me.group;
  g.position.set(cushion.pos.x, 0.12, cushion.pos.z);
  g.rotation.y = Math.PI;
  S.me.seated = true;
  S.me.stop();
  placeCameraBehind(5.5);
  updateHud();
  pushState(true);
}

function standUp(silent) {
  if (S.seat == null) return;
  S.seat = null;
  S.me.seated = false;
  S.me.group.position.y = 0;
  S.me.group.position.z += 0.95;
  if (!silent) pushState(true);
  updateHud();
}

// ───────── 동작 ─────────
const ICONS = {
  hapjang: '<path d="M12 3c-1 2-2 5-2 9v6h4v-6c0-4-1-7-2-9z M9 18h6v2H9z"/>',
  banbae: '<circle cx="12" cy="5" r="2.2"/><path d="M12 8c-3 1-5 4-5 7h3l2-3 2 3h3c0-3-2-6-5-7z"/>',
  keunjeol: '<circle cx="6" cy="15" r="2.2"/><path d="M8 16h9c2 0 3 1 3 3H6z"/>',
  beads: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1.5 2.2"/><circle cx="12" cy="19.5" r="1.6"/>',
  moktak: '<ellipse cx="11" cy="14" rx="7" ry="5"/><path d="M14 4l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  meditate: '<path d="M12 6c2 2 3 5 0 9-3-4-2-7 0-9zM4 12c3 0 6 2 8 5-4 1-7-1-8-5zM20 12c-3 0-6 2-8 5 4 1 7-1 8-5z"/>',
  wave: '<path d="M8 21v-7l-2-3 1-1 3 3V5a1 1 0 012 0v6h1V4a1 1 0 012 0v7h1V6a1 1 0 012 0v9c0 3-2 6-5 6z"/>',
  bae108: '<text x="12" y="16" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">108</text>',
};

function renderActions() {
  $('#actions').innerHTML = ACTIONS.map((a) =>
    `<button class="act" data-act="${a.id}" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[a.id]}</svg>${a.name}<small class="cap">${a.cap}</small></button>`).join('');
}

function doAction(id) {
  if (S.guest) return toast('캐릭터를 만들면 함께 동작할 수 있어요');
  S.target = null;
  const def = ACTIONS.find((a) => a.id === id);
  const on = S.me.play(id);
  if (on && (id === 'keunjeol' || id === 'banbae')) bowl(0.4);
  $('#bae-counter').hidden = !(on && id === 'bae108');
  if (on && id === 'bae108') S.me.onBow(0);
  net.sendAct({ a: id, on });
  pushState(true);
  syncActionButtons();
  if (!on && def.loop) return;
}

function syncActionButtons() {
  document.querySelectorAll('.act').forEach((b) => b.setAttribute('aria-pressed', String(S.me?.action === b.dataset.act)));
  if (S.me?.action !== 'bae108') $('#bae-counter').hidden = true;
}

// ───────── 소원과 연등 ─────────
const LANTERN_COLORS = ['#f08aa0', '#f2c45a', '#f6f2e8', '#9ad0a8', '#9cc0f0', '#f2a05a'];
const LANTERN_NAMES = ['분홍', '노랑', '하양', '연두', '하늘', '주황'];
const AMOUNTS = [{ v: 0, t: '마음만' }, { v: 1000, t: '1,000원' }, { v: 3000, t: '3,000원' }, { v: 10000, t: '10,000원' }];
let wishColor = LANTERN_COLORS[0], wishAmount = 0;

function addWish(w, { animate = false, announce = false } = {}) {
  if (!w || !w.id || S.wishes.some((x) => x.id === w.id)) return;
  S.wishes.push({ id: w.id, n: String(w.n).slice(0, 12), t: String(w.t).slice(0, 80), c: LANTERN_COLORS.includes(w.c) ? w.c : LANTERN_COLORS[0], v: w.v | 0 });
  if (S.wishes.length > 60) S.wishes.shift();
  if (announce) toast(`${w.n}님이 복전함에 소원을 올렸어요`);
  const world = S.worlds[S.loc?.id]?.in;
  if (world) hangLantern(world, S.wishes[S.wishes.length - 1], animate);
}

function hangLantern(world, w, animate) {
  if (S.lanterns.has(w.id)) return;
  const slots = world.lanternSlots;
  let i = [...w.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % slots.length;
  const used = new Set([...S.lanterns.values()].map((l) => l.userData.slot));
  for (let k = 0; k < slots.length && used.has(i); k++) i = (i + 1) % slots.length;
  const l = buildLantern(w.c, 1.2);
  l.userData = { slot: i, wish: w };
  l.traverse((o) => (o.userData.wish = w));
  const dest = slots[i].clone().add(new THREE.Vector3(0, -0.35, 0.4));
  if (animate) {
    l.position.set(0, 1.4, -8.4);
    l.userData.rise = { from: l.position.clone(), to: dest, t: 0 };
  } else l.position.copy(dest);
  world.lanternRoot.add(l);
  S.lanterns.set(w.id, l);
}

function rebuildLanterns() {
  const world = S.worlds[S.loc.id].in;
  for (const l of S.lanterns.values()) l.parent?.remove(l);
  S.lanterns.clear();
  for (const w of S.wishes) hangLantern(world, w, false);
}

function openWish() {
  if (S.guest) return toast('캐릭터를 만들면 소원을 올릴 수 있어요');
  const box = S.active.donationBox;
  if (box && S.me.group.position.distanceTo(new THREE.Vector3(0, 0, -7.1)) > 1.2) {
    standUp();
    S.target = { pos: new THREE.Vector3(0, 0, -7.1), face: Math.PI, onArrive: () => { $('#wish-modal').hidden = false; $('#wish-text').focus(); } };
    return;
  }
  $('#wish-modal').hidden = false;
  $('#wish-text').focus();
}

function submitWish(e) {
  e.preventDefault();
  const text = $('#wish-text').value.trim();
  if (!text) return;
  $('#wish-modal').hidden = true;
  $('#wish-text').value = '';
  const w = { id: `${net.selfId || 'local'}-${Date.now().toString(36)}`, n: S.profile.name, t: text, c: wishColor, v: wishAmount };
  // 소원지가 손에서 복전함으로 날아간다
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), new THREE.MeshStandardMaterial({ color: '#fbf3dc', side: THREE.DoubleSide }));
  const start = S.me.group.position.clone().add(new THREE.Vector3(0, 1.0, -0.3));
  paper.position.copy(start);
  S.active.group.add(paper);
  flyers.push({ obj: paper, from: start, to: new THREE.Vector3(0, 1.25, -8.4), t: 0, dur: 0.9, done: () => {
    S.active.group.remove(paper);
    coin();
    addWish(w, { animate: true });
    net.sendWish(w);
    const mine = store.get('mywishes', []);
    mine.unshift({ ...w, place: S.loc.name, at: Date.now() });
    store.set('mywishes', mine.slice(0, 100));
    toast(wishAmount ? `소원과 함께 ${AMOUNTS.find((a) => a.v === wishAmount).t}을 마음으로 시주했어요` : '소원이 연등이 되어 걸렸어요');
  } });
  S.me.play('hapjang');
  pushState(true);
}
const flyers = [];

function renderWishForm() {
  $('#wish-colors').innerHTML = LANTERN_COLORS.map((c, i) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" aria-pressed="${c === wishColor}" aria-label="${LANTERN_NAMES[i]} 연등" title="${LANTERN_NAMES[i]} 연등"></button>`).join('');
  $('#wish-amounts').innerHTML = AMOUNTS.map((a) => `<button type="button" class="chip" data-v="${a.v}" aria-pressed="${a.v === wishAmount}"><span class="lbl">${a.t}</span><small class="cap">${a.v ? '가상 금액 · 실제 결제 없음' : '시주 없이 소원만'}</small></button>`).join('');
}

// ───────── 토스트 ─────────
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3600);
}

// ───────── HUD ─────────
function updateHud() {
  if (!S.loc) return;
  $('#hud-place').textContent = S.loc.name;
  $('#hud-server').textContent = S.server ? `· 서버 ${S.server}` : '· 서버 찾는 중';
  let n = 0;
  for (const r of S.remotes.values()) n++;
  const here = [...S.remotes.values()].filter((r) => r.st.s === S.scene).length + (S.guest ? 0 : 1);
  $('#hud-people').textContent = `함께 ${n + (S.guest ? 0 : 1)}명 · ${S.scene === 'in' ? '법당 안' : '마당'} ${here}명`;
  $('#btn-inout .lbl').textContent = S.scene === 'in' ? '밖으로 나가기' : '법당 안으로';
  $('#btn-inout .cap').textContent = S.scene === 'in' ? '마당에서 경치 보기' : '불상 앞 방석으로';
  $('#btn-stand').hidden = S.seat == null;
  $('#guest-bar').hidden = !S.guest;
  $('#actions').hidden = S.guest;
}

function updateContext() {
  if (S.mode !== 'world' || !S.active) return;
  const p = S.me.group.position;
  const nearBox = S.scene === 'in' && !S.guest && p.distanceTo(new THREE.Vector3(0, 0, -8.4)) < 3.4;
  $('#btn-wish').hidden = !nearBox;
  $('#btn-enter').hidden = !(S.scene === 'out' && p.distanceTo(S.active.door) < 8);
}

let timerTick = 1;
function updateTimer(dt) {
  if (S.mode !== 'world') return;
  timerTick += dt;
  if (timerTick < 1) return;
  timerTick = 0;
  const sec = (Date.now() - S.enteredAt) / 1000;
  $('#hud-timer').textContent = `머문 시간 ${fmtTime(sec)}`;
  $('#hud-timer').title = `${S.loc.name}에 머문 시간 모두 ${fmtLong(store.get(`stay:${S.loc.id}`, 0))}`;
}
// 누적 시간은 10초마다 저장
setInterval(() => {
  if (S.mode !== 'world' || !S.loc) return;
  const key = `stay:${S.loc.id}`;
  store.set(key, store.get(key, 0) + 10);
}, 10000);

// ───────── 서버 ─────────
function renderServerGrid() {
  if (!S.loc) return;
  const counts = net.counts();
  $('#server-title').textContent = `${S.loc.name} 서버`;
  $('#server-now').textContent = S.server ? `현재 · ${S.loc.name} 서버 ${S.server}` : '서버를 찾는 중이에요';
  let html = '';
  for (let i = 1; i <= SERVER_COUNT; i++) {
    const c = counts[i] || 0;
    const cur = i === S.server, full = c >= SERVER_CAP && !cur;
    html += `<button class="server${cur ? ' current' : ''}${full ? ' full' : ''}" data-server="${i}" ${full ? 'disabled' : ''}>
      <b>${S.loc.name} 서버 ${i}</b><span>${c} / ${SERVER_CAP}명${cur ? ' · 이용 중' : full ? ' · 만석' : ''}</span>
      <small class="cap">${cur ? '지금 머무는 서버' : full ? '자리가 없어 들어갈 수 없어요' : '눌러서 이 서버로 옮기기'}</small></button>`;
  }
  $('#server-grid').innerHTML = html;
}

async function switchServer(n) {
  if (n === S.server) return;
  S.server = n;
  S.wishes = [];
  if (S.worlds[S.loc.id]?.in) rebuildLanterns();
  updateHud();
  await net.joinServer(n);
  pushState(true);
  renderServerGrid();
  toast(`${S.loc.name} 서버 ${n}에 들어왔어요`);
}

// 사람이 가장 많지만 아직 자리가 있는 서버로 자동 배정
function pickServer() {
  const counts = net.counts();
  let best = 1, bestC = -1;
  for (let i = 1; i <= SERVER_COUNT; i++) {
    const c = counts[i] || 0;
    if (c < SERVER_CAP && c > bestC) { best = i; bestC = c; }
  }
  return best;
}

// ───────── 위치 들어가기 ─────────
async function enterLocation(locId) {
  hideScreens();
  $('#loading').hidden = false;
  await new Promise((r) => setTimeout(r, 30));
  S.loc = LOCATIONS.find((l) => l.id === locId);
  S.mode = 'world';
  S.server = 0;
  S.wishes = [];
  S.lanterns.clear();
  makeMe();
  await goScene('out', { intro: true, instant: true });
  $('#loading').hidden = true;
  $('#hud').hidden = false;
  S.enteredAt = Date.now();
  updateHud();
  renderActions();
  syncActionButtons();
  await net.joinLobby(locId, !S.guest);
  if (!net.online) { S.server = 1; updateHud(); toast('실시간 연결이 안 돼서 혼자 머무는 중이에요'); return; }
  await new Promise((r) => setTimeout(r, 1800));
  if (S.loc.id !== locId) return;
  await switchServer(pickServer());
}

function hideScreens() {
  for (const id of ['intro', 'creator', 'places', 'loading']) $('#' + id).hidden = true;
}

// ───────── 첫 화면 / 위치 목록 ─────────
function showIntro() {
  S.mode = 'intro';
  net.leaveAll();
  hideScreens();
  $('#hud').hidden = true;
  $('#intro').hidden = false;
  const p = S.profile;
  $('#btn-continue').hidden = !p;
  if (p) $('#btn-continue .lbl').textContent = `${p.name}님으로 들어가기`;
  $('#btn-new .lbl').textContent = p ? '캐릭터 새로 꾸미기' : '캐릭터 만들고 들어가기';
  $('#btn-new').className = p ? 'ghost' : 'primary';
  // 배경: 두물정사 마당을 천천히 돈다
  S.loc = LOCATIONS[1];
  setWorld(worldFor('river', 'out'));
  if (S.me) S.me.group.visible = false;
  for (const id of [...S.remotes.keys()]) removeRemote(id, false);
}

function showPlaces() {
  hideScreens();
  $('#places').hidden = false;
  $('#place-list').innerHTML = LOCATIONS.map((l) => {
    const stay = store.get(`stay:${l.id}`, 0);
    return `<button class="place" data-place="${l.id}"><canvas width="400" height="300" data-art="${l.id}"></canvas>
      <div class="body"><h3>${l.name}</h3><span class="where">${l.place}</span><p>${l.desc}</p>
      ${stay > 60 ? `<span class="stay">내가 머문 시간 ${fmtLong(stay)}</span>` : ''}
      <small class="cap-line">눌러서 이 법당으로 가기 · 마당에 먼저 도착해요</small></div></button>`;
  }).join('');
  document.querySelectorAll('[data-art]').forEach((c) => paintView(LOCATIONS.find((l) => l.id === c.dataset.art), c.getContext('2d'), c.width, c.height));
}

// ───────── 캐릭터 꾸미기 ─────────
let preview = null, draft = null, creatorReturn = 'places';
function openCreator(ret) {
  creatorReturn = ret;
  draft = S.profile ? structuredClone(S.profile) : { name: randomName(), look: defaultLook() };
  $('#creator').hidden = false;
  $('#nick').value = draft.name;
  renderCreatorOptions();
  if (!preview) initPreview();
  preview.avatar.build(draft.look);
}

function initPreview() {
  const c = $('#preview');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#fff7e8', '#b59a7a', 1.6));
  const d = new THREE.DirectionalLight('#ffffff', 2.2); d.position.set(2, 4, 3); sc.add(d);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  cam.position.set(0, 1.4, 5.2);
  const ctl = new OrbitControls(cam, c);
  ctl.target.set(0, 0.85, 0); ctl.enablePan = false; ctl.enableZoom = false; ctl.autoRotate = true; ctl.autoRotateSpeed = 1.6;
  const avatar = new Avatar(draft.look, '', {});
  avatar.tag.visible = false;
  sc.add(avatar.group);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: '#d9c4a0', transparent: true, opacity: 0.6 }));
  disc.rotation.x = -Math.PI / 2; sc.add(disc);
  preview = { r, sc, cam, ctl, avatar, t: 0 };
}

function renderPreview(dt) {
  if (!preview || $('#creator').hidden) return;
  const c = $('#preview');
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.floor(w * preview.r.getPixelRatio())) { preview.r.setSize(w, h, false); preview.cam.aspect = w / h; preview.cam.updateProjectionMatrix(); }
  preview.t += dt;
  // 미리보기에서는 동작을 차례로 보여준다
  if (!preview.avatar.action && preview.t > 3) { preview.t = 0; preview.avatar.play(['hapjang', 'wave', 'banbae'][Math.floor(Math.random() * 3)]); }
  preview.avatar.update(dt, ACTIONS);
  preview.ctl.update();
  preview.r.render(preview.sc, preview.cam);
}

function renderCreatorOptions() {
  const L = draft.look;
  $('#opt-type').innerHTML = CHAR_TYPES.map((t) => `<button class="chip" data-type="${t.id}" aria-pressed="${L.type === t.id}"><span class="lbl">${t.name}</span><small class="cap">${t.desc}</small></button>`).join('');
  $('#opt-skin').innerHTML = SKIN_TONES.map((s, i) => `<button class="swatch" data-skin="${s}" style="background:${s}" aria-pressed="${L.skin === s}" aria-label="${i + 1}번째 색" title="${['가장 밝은', '밝은', '중간', '짙은', '가장 짙은'][i]} 색"></button>`).join('');
  $('#opt-outfit').innerHTML = OUTFITS.map((o) => `<button class="chip" data-outfit="${o.id}" aria-pressed="${L.outfit === o.id}"><span class="lbl"><span class="dot" style="background:${o.top}"></span><span class="dot" style="background:${o.sash}"></span>${o.name}</span><small class="cap">${o.cap}</small></button>`).join('');
  $('#opt-acc').innerHTML = ACCESSORIES.map((a) => `<button class="chip" data-acc="${a.id}" aria-pressed="${L.acc === a.id}"><span class="lbl">${a.name}</span><small class="cap">${a.cap}</small></button>`).join('');
}

function finishCreator() {
  draft.name = $('#nick').value.trim().slice(0, 10) || randomName();
  S.profile = draft;
  store.set('profile', S.profile);
  $('#creator').hidden = true;
  if (creatorReturn === 'world') {
    const wasGuest = S.guest;
    S.guest = false;
    S.me.build(S.profile.look);
    S.me.setName(S.profile.name);
    S.me.group.visible = true;
    if (wasGuest) { net.me.c = true; net.sendSrv?.(net.me); renderActions(); }
    updateHud();
    pushState(true);
    toast('새 모습으로 바꿨어요');
  } else showPlaces();
}

// ───────── 입력 ─────────
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const joy = { x: 0, y: 0, id: null };
const joyEl = $('#joystick'), knob = joyEl.querySelector('.knob');
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  joy.x = x; joy.y = y;
  knob.style.transform = `translate(${x * 35}px, ${y * 35}px)`;
}

// 화면 탭: 방석 → 바로 앉기, 복전함 → 소원, 연등 → 소원 읽기, 바닥 → 걸어가기
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || S.mode !== 'world') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const w = S.active;
  const hits = ray.intersectObjects(w.group.children, true);
  for (const h of hits) {
    const o = h.object;
    if (o.userData.wish) { const wi = o.userData.wish; toast(`“${wi.t}” · ${wi.n}님의 연등`); return; }
    if (o.userData.seat != null) { const c = w.cushions.find((c) => c.id === o.userData.seat); if (c) return sitOn(c); }
    if (o.userData.donation) return openWish();
    if (o === w.floor || o.parent === w.floor) {
      if (S.guest || S.me.action && !ACTIONS.find((a) => a.id === S.me.action)?.loop) return;
      standUp();
      S.target = { pos: h.point.clone().setY(0) };
      return;
    }
    if (S.scene === 'out' && h.distance < 60 && Math.abs(h.point.x) < 12 && h.point.z < -1 && h.point.z > -20) {
      S.target = { pos: w.door.clone(), onArrive: () => goScene('in') };
      return;
    }
  }
});

// ───────── 이동 ─────────
const tmpV = new THREE.Vector3();
const SPEED = 3.4;
function moveMe(dt) {
  const me = S.me, g = me.group;
  let dx = 0, dz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  dx += joy.x; dz += joy.y;
  let dir = null;
  if (Math.hypot(dx, dz) > 0.15) {
    S.target = null;
    if (S.seat != null) standUp();
    // 카메라가 보는 방향 기준으로 움직인다
    const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    dir = new THREE.Vector3(dx * cos + dz * sin, 0, -dx * sin + dz * cos);
    if (dir.length() > 1) dir.normalize();
  } else if (S.target) {
    tmpV.copy(S.target.pos).sub(g.position).setY(0);
    const d = tmpV.length();
    if (d < 0.18) {
      const t = S.target; S.target = null;
      if (t.face != null) g.rotation.y = t.face;
      t.onArrive?.();
    } else dir = tmpV.normalize();
  }
  if (dir && S.me.action && S.me.action !== 'meditate') { S.me.stop(); syncActionButtons(); }
  const before = g.position.clone();
  if (dir) {
    g.position.addScaledVector(dir, SPEED * dt);
    const want = Math.atan2(dir.x, dir.z);
    let diff = want - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 12);
    collide(g.position);
    if (S.target && g.position.distanceTo(before) < SPEED * dt * 0.2) S.target = null;
  }
  me.speed = dir ? g.position.distanceTo(before) / Math.max(dt, 1e-4) : 0;
  // 카메라도 같이 따라온다
  const delta = g.position.clone().sub(before);
  camera.position.add(delta);
  controls.target.add(delta);

  // 문 근처에 가면 들어가고 나간다
  if (S.scene === 'in' && g.position.z > 14.4 && Math.abs(g.position.x) < 2.6) goScene('out');
  else if (S.scene === 'out' && dir && g.position.distanceTo(S.active.door) < 1.3) goScene('in');
}

function collide(p) {
  const w = S.active;
  if (w.bounds) {
    p.x = Math.min(w.bounds.maxX, Math.max(w.bounds.minX, p.x));
    p.z = Math.min(w.bounds.maxZ, Math.max(w.bounds.minZ, p.z));
  }
  if (w.radius) {
    const d = Math.hypot(p.x, p.z);
    if (d > w.radius) { p.x *= w.radius / d; p.z *= w.radius / d; }
  }
  for (const b of w.blockers) {
    if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ) {
      const pen = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
      const m = Math.min(...pen);
      if (m === pen[0]) p.x = b.minX; else if (m === pen[1]) p.x = b.maxX; else if (m === pen[2]) p.z = b.minZ; else p.z = b.maxZ;
    }
  }
}

// ───────── 루프 ─────────
const clock = new THREE.Clock();
let elapsed = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  if (S.mode === 'intro') {
    const a = elapsed * 0.04;
    camera.position.set(Math.sin(a) * 26, 14, Math.cos(a) * 26 + 6);
    camera.lookAt(Math.sin(a + 2.6) * 60, -8, Math.cos(a + 2.6) * 60 + 40);
  } else if (S.mode === 'world') {
    if (S.camAnim) {
      const A = S.camAnim;
      A.t += dt;
      const k = Math.min(1, A.t / A.dur);
      const e = k < 0.35 ? 0 : (k - 0.35) / 0.65;
      const s = e * e * (3 - 2 * e);
      camera.position.lerpVectors(A.fromPos, A.toPos, s);
      controls.target.lerpVectors(A.fromTarget, A.toTarget, s);
      camera.lookAt(controls.target);
      if (k >= 1 || keys.size || joy.id != null) { S.camAnim = null; camera.position.copy(A.toPos); controls.target.copy(A.toTarget); }
    } else {
      moveMe(dt);
      controls.update();
    }
    S.me.update(dt, ACTIONS);
    if (!S.me.action && document.querySelector('.act[aria-pressed="true"]')) syncActionButtons();
    soundFor(S.me, 1);
    for (const r of S.remotes.values()) {
      const g = r.av.group;
      const before = g.position.clone();
      const target = r.av.seated ? tmpV.copy(r.pos).setY(0.12) : r.pos;
      g.position.lerp(target, Math.min(1, dt * 8));
      if (g.position.distanceTo(target) > 6) g.position.copy(target);
      let diff = r.rot - g.rotation.y;
      g.rotation.y += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(1, dt * 8);
      r.av.speed = r.av.seated ? 0 : g.position.distanceTo(before) / Math.max(dt, 1e-4);
      r.av.update(dt, ACTIONS);
      // 멀리 있는 사람의 이름표는 숨겨서 화면이 붐비지 않게
      r.av.tag.visible = g.position.distanceTo(camera.position) < 13;
      if (g.visible) soundFor(r.av, Math.max(0, 1 - g.position.distanceTo(S.me.group.position) / 16));
    }
    // 오래 소식이 없는 사람은 정리
    const now = performance.now();
    for (const [id, r] of S.remotes) if (now - r.seen > 15000) removeRemote(id, false);
    pushState();
    updateContext();
    updateTimer(dt);
    if (S.active.update) S.active.update(elapsed);
    if (S.active.flames) for (const f of S.active.flames) f.scale.set(1, 1.8 + Math.sin(elapsed * 13 + f.id) * 0.25, 1);
    for (const l of S.lanterns.values()) {
      const rise = l.userData.rise;
      if (rise) {
        rise.t += dt / 2.6;
        const s = Math.min(1, rise.t), e = s * s * (3 - 2 * s);
        l.position.lerpVectors(rise.from, rise.to, e);
        if (s >= 1) delete l.userData.rise;
      } else l.rotation.y += dt * 0.15;
    }
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t += dt / f.dur;
      const s = Math.min(1, f.t);
      f.obj.position.lerpVectors(f.from, f.to, s);
      f.obj.position.y += Math.sin(s * Math.PI) * 0.8;
      f.obj.rotation.y += dt * 8;
      if (s >= 1) { flyers.splice(i, 1); f.done(); }
    }
  } else if (S.mode === 'gallery') {
    for (const av of galleryAvatars) av.update(dt, ACTIONS);
  }
  renderPreview(dt);
  renderer.render(scene, camera);
}

// 목탁 소리: 채가 내려칠 때마다
function soundFor(av, vol) {
  if (av.action !== 'moktak' || vol <= 0) { av._hit = null; return; }
  const n = Math.floor(av.actionT * 1.1 + 0.25);
  if (av._hit !== n) { if (av._hit != null) moktak(vol); av._hit = n; }
}

// ───────── 버튼 연결 ─────────
document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.close) { $('#' + t.dataset.close).hidden = true; if (t.dataset.close === 'places' && S.mode !== 'world') showIntro(); if (t.dataset.close === 'creator' && S.mode !== 'world') showIntro(); return; }
  if (t.dataset.act) return doAction(t.dataset.act);
  if (t.dataset.place) { if (!sound.on && !params.has('mute')) { setSound(true); syncSoundBtn(); } return enterLocation(t.dataset.place); }
  if (t.dataset.server) { $('#server-modal').hidden = true; return switchServer(+t.dataset.server); }
  if (t.dataset.type) { draft.look.type = t.dataset.type; }
  else if (t.dataset.skin) { draft.look.skin = t.dataset.skin; }
  else if (t.dataset.outfit) { draft.look.outfit = t.dataset.outfit; }
  else if (t.dataset.acc) { draft.look.acc = t.dataset.acc; }
  if (t.dataset.type || t.dataset.skin || t.dataset.outfit || t.dataset.acc) { renderCreatorOptions(); preview.avatar.build(draft.look); return; }
  if (t.dataset.c) { wishColor = t.dataset.c; return renderWishForm(); }
  if (t.dataset.v != null && t.closest('#wish-amounts')) { wishAmount = +t.dataset.v; return renderWishForm(); }
  if (t.dataset.menu) {
    $('#menu').hidden = true;
    const m = t.dataset.menu;
    if (m === 'char') openCreator('world');
    if (m === 'place') { showPlaces(); }
    if (m === 'server') { renderServerGrid(); $('#server-modal').hidden = false; }
    if (m === 'mywish') {
      const list = store.get('mywishes', []);
      $('#mywish-list').innerHTML = list.length ? list.map((w) => `<li>${escapeHtml(w.t)}<small>${w.place} · ${new Date(w.at).toLocaleString('ko-KR')}</small></li>`).join('') : '<li>아직 올린 소원이 없어요. 법당 안 복전함 앞에서 올릴 수 있어요.</li>';
      $('#mywish-modal').hidden = false;
    }
    if (m === 'credit') $('#credit-modal').hidden = false;
    if (m === 'home') showIntro();
  }
});
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('#btn-new').onclick = () => { S.guest = false; openCreator('places'); };
$('#btn-continue').onclick = () => { S.guest = false; showPlaces(); };
$('#btn-guest').onclick = () => { S.guest = true; showPlaces(); };
$('#guest-make').onclick = () => openCreator('world');
$('#nick-dice').onclick = () => { $('#nick').value = randomName(); };
$('#creator-done').onclick = finishCreator;
$('#btn-menu').onclick = () => { $('#menu').hidden = !$('#menu').hidden; };
$('#btn-inout').onclick = () => goScene(S.scene === 'in' ? 'out' : 'in');
$('#btn-enter').onclick = () => goScene('in');
$('#btn-stand').onclick = () => standUp();
$('#btn-wish').onclick = openWish;
$('#server-chip').onclick = () => { renderServerGrid(); $('#server-modal').hidden = false; };
$('#server-refresh').onclick = () => { renderServerGrid(); toast('인원을 새로 셌어요'); };
const syncSoundBtn = () => {
  $('#btn-sound .lbl').textContent = sound.on ? '🔊' : '🔈';
  $('#btn-sound .cap').textContent = sound.on ? '소리 끄기' : '소리 켜기';
};
syncSoundBtn();
$('#btn-sound').onclick = () => { setSound(!sound.on); syncSoundBtn(); };
$('#wish-form').addEventListener('submit', submitWish);
renderWishForm();

// ───────── 시안용 화면 (?gallery=types|outfits|acc, ?demo=in|out&loc=..&bots=N) ─────────
const galleryAvatars = [];
function gallery(kind) {
  S.mode = 'gallery';
  hideScreens();
  scene.background = new THREE.Color('#efe6d6');
  scene.add(new THREE.HemisphereLight('#fff7e8', '#b59a7a', 1.5));
  const d = new THREE.DirectionalLight('#ffffff', 2.4); d.position.set(3, 6, 5); d.castShadow = true; scene.add(d);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: '#e6d9c2' }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const items = kind === 'types' ? CHAR_TYPES.map((t, i) => ({ look: { ...defaultLook(), type: t.id, outfit: OUTFITS[i].id, skin: SKIN_TONES[i % 3] }, name: t.name }))
    : kind === 'outfits' ? OUTFITS.map((o) => ({ look: { ...defaultLook(), outfit: o.id }, name: o.name }))
    : ACCESSORIES.map((a, i) => ({ look: { ...defaultLook(), type: ['dongja', 'bosal', 'cheosa', 'dongja', 'bosal', 'cheosa'][i], acc: a.id, outfit: OUTFITS[i].id }, name: a.name }));
  const acts = (params.get('acts') || '').split(',');
  items.forEach((it, i) => {
    const av = new Avatar(it.look, it.name);
    av.group.position.set((i - (items.length - 1) / 2) * 1.55, 0, 0);
    if (acts[i]) av.play(acts[i]);
    scene.add(av.group);
    galleryAvatars.push(av);
  });
  camera.fov = 40; camera.updateProjectionMatrix();
  camera.position.set(0, 1.6, 9.2);
  camera.lookAt(0, 0.85, 0);
  controls.enabled = false;
}

function demo(which) {
  S.guest = false;
  S.profile = { name: '맑은 빗방울', look: { type: params.get('type') || 'dongja', skin: SKIN_TONES[0], outfit: params.get('outfit') || 'seungbok', acc: 'none' } };
  S.loc = LOCATIONS.find((l) => l.id === (params.get('loc') || 'forest'));
  S.mode = 'world';
  S.server = 6;
  makeMe();
  hideScreens();
  $('#hud').hidden = params.has('nohud');
  renderActions();
  goScene(which, { instant: true });
  S.camAnim = null;
  S.enteredAt = Date.now() - 754000;
  const n = +(params.get('bots') || 0);
  const looks = CHAR_TYPES.map((t) => t.id);
  const rnd = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const world = S.active;
  for (let i = 0; i < n; i++) {
    const look = { type: looks[Math.floor(rnd() * looks.length)], skin: SKIN_TONES[Math.floor(rnd() * 3)], outfit: OUTFITS[Math.floor(rnd() * OUTFITS.length)].id, acc: ACCESSORIES[Math.floor(rnd() * ACCESSORIES.length)].id };
    const seat = which === 'in' && rnd() < 0.7 ? world.cushions[Math.floor(rnd() * world.cushions.length)] : null;
    const pos = seat ? [seat.pos.x, seat.pos.z] : which === 'in' ? [(rnd() - 0.5) * 18, (rnd() - 0.3) * 18] : [(rnd() - 0.5) * 24, rnd() * 16];
    const act = ['hapjang', 'beads', 'meditate', 'moktak', null, null][Math.floor(rnd() * 6)];
    handleRemoteState('bot' + i, { n: randomName(), l: look, s: which, p: pos, r: seat ? Math.PI : rnd() * 6, seat: seat ? seat.id : null, a: act, at: rnd() * 2 });
  }
  for (const r of S.remotes.values()) { r.seen = Infinity; r.av.group.position.copy(r.pos); if (r.av.seated) r.av.group.position.y = 0.12; }
  if (params.get('act')) S.me.play(params.get('act'));
  if (params.get('seat')) sitOn(world.cushions[+params.get('seat')]);
  const cam = params.get('cam');
  if (cam) {
    const [x, y, z, tx, ty, tz] = cam.split(',').map(Number);
    camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update();
  }
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  if (params.get('toast')) toast(params.get('toast'));
  updateHud();
}

// ───────── 시작 ─────────
(async () => {
  if (!params.has('demo') && !params.has('gallery')) preloadNet();
  try { await Promise.race([document.fonts.load('700 40px "Gowun Batang"'), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  if (params.get('gallery')) gallery(params.get('gallery'));
  else if (params.get('demo')) demo(params.get('demo'));
  else if (params.get('auto')) {
    // 바로 입장 (공유 링크·접속 테스트용): ?auto=forest|river|sea
    if (!S.profile) { S.profile = { name: randomName(), look: defaultLook() }; store.set('profile', S.profile); }
    S.guest = false;
    enterLocation(LOCATIONS.some((l) => l.id === params.get('auto')) ? params.get('auto') : 'forest');
  }
  else showIntro();
  if (params.get('screen') === 'creator') openCreator('places');
  if (params.get('screen') === 'places') showPlaces();
  $('#loading').hidden = true;
  loop();
})();
