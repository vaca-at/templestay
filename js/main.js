// 앱 흐름: 로딩(두물머리 풍경이 돈다) → 바로 법당 안 → 꾸미기·시간표는 들어간 다음에.
// 장소는 마당(out) · 법당(in) · 공양간(meal) · 내 방(room). 시간표가 바뀌는 때마다 캐릭터가 알아서 옮겨 간다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  LOCATIONS, CHAR_TYPES, OUTFITS, ACCESSORIES, SKIN_TONES, ACTIONS, SERVER_COUNT, SERVER_CAP, GENDERS,
  ACTIVITIES, DEFAULT_SCHEDULE, SCENES, BUDDHAS, randomName, defaultLook, isOldAutoName,
} from './data.js';
import { PETS } from './blocky.js';
import { Avatar } from './avatar.js';
import { buildInterior, buildExterior, buildMealHall, buildRoom, buildBoriamView, buildLantern, paintView, PAGODAS } from './world.js';
import { Net, preloadNet } from './net.js';
import { hangScroll, stopScrolls, openScrolls } from './scrolls.js';
import { setSound, sound, moktak, bowl, coin } from './audio.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem('maeum:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('maeum:' + k, JSON.stringify(v)); } catch {} },
};
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (sec) => {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const fmtLong = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${m}분`;
};
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ───────── 상태 ─────────
// 처음 온 사람도 기본 캐릭터로 바로 들어간다 (꾸미기는 나중에)
let profile = store.get('profile', null);
if (!profile) { profile = { name: randomName(), look: defaultLook() }; store.set('profile', profile); }
// 예전 낱말로 저절로 지어진 법명은 지금 낱말로 한 번 바꿔 줘요 (직접 지은 이름은 그대로)
if (isOldAutoName(profile.name)) { profile.name = randomName(); store.set('profile', profile); }
profile.look = { ...defaultLook(), ...profile.look };
if (!CHAR_TYPES.some((t) => t.id === profile.look.type)) profile.look.type = defaultLook().type;

const S = {
  profile,
  loc: null,
  server: 0,
  scene: 'in',
  worlds: {},
  active: null,
  me: null,
  seat: null,
  target: null,
  remotes: new Map(),
  wishes: [],
  lanterns: new Map(),
  enteredAt: 0,
  mode: 'loading', // loading | world | gallery
  schedule: store.get('schedule', structuredClone(DEFAULT_SCHEDULE)),
  blockKey: undefined,
  autoAct: null, // 지금 시간표가 시키고 있는 활동
  walking: false,
};

const net = new Net({
  onCounts: () => { renderServerGrid(); updateHud(); },
  onState: handleRemoteState,
  onAct: (peer, d) => {
    const r = S.remotes.get(peer);
    if (d.a === 'jump') { if (r) r.jumpT = 0; return; }
    const def = ACTIONS.find((a) => a.id === d.a);
    if (r && def && !def.auto && d.on !== false && r.st.s === S.scene) toast(`${r.st.n}님이 ${def.verb}`);
  },
  onWish: (peer, w, backlog) => addWish(w, { animate: !backlog, announce: !backlog }),
  onLeave: (peer) => removeRemote(peer, true),
  onReset: () => { for (const id of [...S.remotes.keys()]) removeRemote(id, false); },
  onFull: (n) => { toast(`서버 ${n}이 가득 차서 다른 서버로 옮겨요`); switchServer(n % SERVER_COUNT + 1); },
  getWishes: () => S.wishes,
  peerCount: () => S.remotes.size,
});

// ───────── 월드 ─────────
const BUILDERS = { in: buildInterior, out: buildExterior, meal: buildMealHall, room: buildRoom, boriam: buildBoriamView };
function worldFor(locId, which) {
  const w = (S.worlds[locId] ||= {});
  if (!w[which]) {
    const loc = LOCATIONS.find((l) => l.id === locId);
    w[which] = BUILDERS[which](loc);
    if (which === 'out') applyPagoda(w.out);
  }
  return w[which];
}

// 실제 불상 3D 스캔 (국립중앙박물관). 법당에서 불상 쪽에 커서를 올리면 ‹ › 로 넘겨 볼 수 있고, 고른 불상은 이 기기에 남는다.
// ?buddha=iron 처럼 주소로도 고를 수 있다
const BUDDHA_IDS = Object.keys(BUDDHAS);
let buddhaId = [params.get('buddha'), store.get('buddha', null)].find((id) => BUDDHAS[id]) || BUDDHA_IDS[0];
const buddhaGLB = {};
async function loadBuddha(world, id = buddhaId) {
  if (world.buddhaSlot.userData.scan === id) return;
  const B = BUDDHAS[id];
  try {
    if (!buddhaGLB[id]) {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      buddhaGLB[id] = loader.loadAsync(B.file);
    }
    const gltf = await buddhaGLB[id];
    if (id !== buddhaId) return; // 불러오는 사이 다른 불상을 골랐으면 그쪽을 건다
    const model = new THREE.Group();
    const inner = gltf.scene.clone(true);
    if (B.zUp) inner.rotation.x = -Math.PI / 2;
    model.add(inner);
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar((B.height || 4.6) / box.getSize(new THREE.Vector3()).y);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    world.buddhaSlot.clear();
    world.buddhaSlot.add(model);
    world.buddhaSlot.userData.scan = id;
  } catch (e) { console.warn('불상 모델을 불러오지 못해 기본 불상을 써요', e); }
}

// 불상·탑 고르기: 메뉴의 설정 창에서 ‹ › 로 넘긴다 (화면을 가리지 않게). 고른 것은 이 기기에 남는다
function stepBuddha(step) {
  const i = BUDDHA_IDS.indexOf(buddhaId);
  buddhaId = BUDDHA_IDS[(i + step + BUDDHA_IDS.length) % BUDDHA_IDS.length];
  store.set('buddha', buddhaId);
  for (const w of Object.values(S.worlds)) if (w.in) loadBuddha(w.in);
  renderRelics();
}

const PAGODA_IDS = PAGODAS.map((p) => p.id);
let pagodaId = [params.get('pagoda'), store.get('pagoda', null)].find((id) => PAGODA_IDS.includes(id)) || PAGODA_IDS[0];
function applyPagoda(world) { if (world.pagodaSlot.userData.id !== pagodaId) world.setPagoda(pagodaId); }
function stepPagoda(step) {
  const i = PAGODA_IDS.indexOf(pagodaId);
  pagodaId = PAGODA_IDS[(i + step + PAGODA_IDS.length) % PAGODA_IDS.length];
  store.set('pagoda', pagodaId);
  for (const w of Object.values(S.worlds)) if (w.out) applyPagoda(w.out);
  renderRelics();
}

function renderRelics() {
  const B = BUDDHAS[buddhaId];
  $('#relic-b-name').textContent = B.name;
  $('#relic-b-sub').textContent = `${B.from} · ${B.no} · ${BUDDHA_IDS.indexOf(buddhaId) + 1} / ${BUDDHA_IDS.length}`;
  const P = PAGODAS.find((p) => p.id === pagodaId);
  $('#relic-p-name').textContent = P.name;
  $('#relic-p-sub').textContent = `${P.from} · ${P.note} · ${PAGODA_IDS.indexOf(pagodaId) + 1} / ${PAGODA_IDS.length}`;
}
function openRelics() { renderRelics(); $('#relic-modal').hidden = false; }

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
  S.me = new Avatar(S.profile.look, S.profile.name, { mine: true });
  S.me.onBow = (n) => {
    $('#bae-counter').innerHTML = `<small>108배</small><b>${n}</b><small>/ 108</small>`;
    if (n > 0) addRecord('bows', 1);
    if (n >= 108) { bowl(); toast('108배를 모두 마쳤어요'); setTimeout(() => ($('#bae-counter').hidden = true), 2500); }
  };
  players.add(S.me.group);
}

// ───────── 장소 옮기기 ─────────
const fade = (on) => new Promise((r) => { $('#fade').classList.toggle('on', on); setTimeout(r, on ? 460 : 10); });

async function goScene(which, { instant = false } = {}) {
  const from = S.scene;
  if (!instant) await fade(true);
  standUp(true);
  S.walking = false;
  S.target = null;
  S.scene = which;
  const world = worldFor(S.loc.id, which);
  setWorld(world);
  if (which === 'in') { rebuildLanterns(); loadBuddha(world); }
  S.me.dress(which);
  const me = S.me.group;
  if (which === 'out') {
    // 건물에서 나오면 법당 문 앞에, 바깥을 바라보고 선다
    me.position.copy(world.door).add(new THREE.Vector3(0, 0, 2.6));
    me.rotation.y = from === 'in' || from === 'meal' || from === 'room' ? 0 : world.spawnRot;
  } else {
    me.position.copy(world.spawn);
    me.rotation.y = world.spawnRot;
  }
  controls.minDistance = world.minDist || 2.2;
  controls.maxDistance = world.maxDist || (which === 'out' ? 38 : 13);
  placeCameraBehind(world.camDist || 5);
  if (which === 'room') {
    sitOn(world.seats[0], { auto: true });
    // 책 읽는 얼굴이 보이도록 앞쪽 비스듬히
    camera.position.set(2.5, 2.2, -2.7);
    controls.target.set(0, 0.8, -0.7);
    controls.update();
  }
  S.me.tag.visible = which !== 'room';
  // 내 방 족자는 들어올 때마다 문구가 바뀐다
  if (which === 'room') hangScroll(world); else stopScrolls();
  refreshRemoteVisibility();
  updateHud();
  pushState(true);
  if (!instant) fade(false);
}

function placeCameraBehind(dist) {
  const me = S.me.group;
  const back = new THREE.Vector3(Math.sin(me.rotation.y), 0, Math.cos(me.rotation.y)).multiplyScalar(-dist);
  controls.target.copy(me.position).add(new THREE.Vector3(0, S.active.camLookY ?? 1.1, 0));
  camera.position.copy(me.position).add(back).add(new THREE.Vector3(0, 1.1 + dist * 0.42, 0));
  controls.update();
}

// ───────── 다른 사람들 ─────────
// 내 방은 혼자만의 공간이라 서로 보이지 않는다
const visibleTo = (st) => st.s === S.scene && S.scene !== 'room';

function handleRemoteState(peer, d) {
  if (!d || !d.l || !d.n || !Array.isArray(d.p)) return;
  let r = S.remotes.get(peer);
  if (!r) {
    const av = new Avatar(d.l, String(d.n).slice(0, 12));
    players.add(av.group);
    av.group.position.set(d.p[0], 0, d.p[1]);
    av.group.rotation.y = d.r;
    r = { av, st: d, pos: new THREE.Vector3(d.p[0], 0, d.p[1]), rot: d.r, appliedA: null, lookKey: JSON.stringify(d.l), seen: 0 };
    S.remotes.set(peer, r);
    if (S.mode === 'world') toast(`${d.n}님이 큰법당에 오셨어요`);
  }
  const lookKey = JSON.stringify(d.l);
  if (lookKey !== r.lookKey) { r.av.setLook(d.l, d.s); r.lookKey = lookKey; }
  else r.av.dress(d.s);
  if (d.n !== r.st.n) r.av.setName(String(d.n).slice(0, 12));
  if (d.s !== r.st.s) r.av.group.position.set(d.p[0], 0, d.p[1]);
  r.st = d;
  r.seen = performance.now();
  r.pos.set(d.p[0], 0, d.p[1]);
  r.rot = d.r;
  r.av.seated = d.seat != null;
  r.seatY = d.y || 0.12;
  if (d.a !== r.appliedA) {
    r.appliedA = d.a;
    if (d.a) { r.av.action = d.a; r.av.actionT = d.at || 0; r.av.bowCount = 0; }
    else if (ACTIONS.find((a) => a.id === r.av.action)?.loop) r.av.stop();
  }
  r.av.group.visible = visibleTo(d);
  updateHud();
}

function removeRemote(peer, announce) {
  const r = S.remotes.get(peer);
  if (!r) return;
  players.remove(r.av.group);
  r.av.dispose();
  S.remotes.delete(peer);
  if (announce && S.mode === 'world') toast(`${r.st.n}님이 법당을 나섰어요`);
  updateHud();
}

function refreshRemoteVisibility() {
  for (const r of S.remotes.values()) r.av.group.visible = visibleTo(r.st);
}

function seatTaken(id) {
  for (const r of S.remotes.values()) if (r.st.s === S.scene && r.st.seat === id) return true;
  return false;
}

// ───────── 상태 보내기 ─────────
let lastSent = '', lastSentAt = 0;
function pushState(force = false) {
  if (!S.me || S.mode !== 'world') return;
  const g = S.me.group;
  const st = {
    n: S.profile.name, l: S.profile.look, s: S.scene,
    p: [Math.round(g.position.x * 100) / 100, Math.round(g.position.z * 100) / 100],
    r: Math.round(g.rotation.y * 100) / 100,
    seat: S.seat, y: S.seat != null ? g.position.y : 0,
    a: S.me.action, at: S.me.action ? Math.round(S.me.actionT * 10) / 10 : 0,
  };
  const key = JSON.stringify({ ...st, at: 0 });
  const now = performance.now();
  // 바뀐 게 있으면 0.25초마다, 없으면 5초마다 한 번
  if (force || (key !== lastSent && now - lastSentAt > 250) || now - lastSentAt > 5000) {
    lastSent = key; lastSentAt = now;
    net.sendState(st);
  }
}

// ───────── 앉기 / 일어서기 ─────────
function sitOn(seat, { auto = false } = {}) {
  if (seat.id !== undefined && S.scene !== 'room' && seatTaken(seat.id)) { if (!auto) toast('다른 분이 앉아 계신 자리예요'); return false; }
  if (!auto) pauseAuto();
  S.seat = seat.id;
  S.target = null;
  S.walking = false;
  const g = S.me.group;
  g.position.set(seat.pos.x, seat.y ?? 0.12, seat.pos.z);
  g.rotation.y = seat.rot ?? Math.PI;
  S.me.seated = true;
  S.me.stop();
  if (S.scene !== 'room') turnCameraToFace(S.active.camDist || 5);
  updateHud();
  pushState(true);
  return true;
}

// 앉으면 카메라가 옆으로 천천히 돌아 앞에서 내 얼굴을 비춘다. 화면을 끌거나 걸으면 바로 멈춘다
let camTurn = null;
function turnCameraToFace(dist) {
  const g = S.me.group;
  const off = camera.position.clone().sub(controls.target);
  camTurn = {
    t: 0,
    from: { yaw: Math.atan2(off.x, off.z), r: Math.hypot(off.x, off.z), y: off.y, at: controls.target.clone() },
    to: { yaw: g.rotation.y + 0.4, r: dist * 0.8, y: dist * 0.2, at: g.position.clone().add(new THREE.Vector3(0, 0.95, 0)) },
  };
}
function stepCameraTurn(dt) {
  if (!camTurn) return;
  camTurn.t = Math.min(1, camTurn.t + dt / 1.4);
  const e = camTurn.t * camTurn.t * (3 - 2 * camTurn.t);
  const { from, to } = camTurn;
  const yaw = from.yaw + Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw)) * e;
  const r = from.r + (to.r - from.r) * e;
  controls.target.lerpVectors(from.at, to.at, e);
  camera.position.set(controls.target.x + Math.sin(yaw) * r, controls.target.y + from.y + (to.y - from.y) * e, controls.target.z + Math.cos(yaw) * r);
  if (camTurn.t >= 1) camTurn = null;
}
controls.addEventListener('start', () => { camTurn = null; });

// 빈자리를 누르면 그 자리까지 천천히 걸어가서 앉는다 (내 방은 자리가 하나라 바로)
function walkToSeat(seat) {
  if (seat.id !== undefined && S.scene !== 'room' && seatTaken(seat.id)) { toast('다른 분이 앉아 계신 자리예요'); return; }
  pauseAuto();
  if (S.seat === seat.id) return;
  if (S.me.action) { S.me.stop(); syncActionButtons(); }
  const sit = () => {
    if (!sitOn(seat)) return;
    if (S.scene === 'meal') startLoop('eat');
    if (S.scene === 'room') startLoop('read');
  };
  if (S.scene === 'room') { sit(); return; }
  standUp();
  S.target = { pos: new THREE.Vector3(seat.pos.x, 0, seat.pos.z), speed: SEAT_SPEED, onArrive: sit };
}

function standUp(silent) {
  if (S.seat == null) return;
  camTurn = null;
  const back = S.me.group.rotation.y;
  S.seat = null;
  S.me.seated = false;
  S.me.group.position.y = 0;
  S.me.group.position.x -= Math.sin(back) * 0.9;
  S.me.group.position.z -= Math.cos(back) * 0.9;
  if (S.active) collide(S.me.group.position);
  if (!silent) pushState(true);
  updateHud();
}

function freeSeat(seats, random = true) {
  const free = seats.filter((s) => !seatTaken(s.id));
  if (!free.length) return seats[Math.floor(Math.random() * seats.length)];
  return random ? free[Math.floor(Math.random() * Math.min(free.length, 30))] : free[0];
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
  $('#actions').innerHTML = ACTIONS.filter((a) => !a.auto).map((a) =>
    `<button class="act" data-act="${a.id}" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[a.id]}</svg>${a.name}<small class="cap">${a.cap}</small></button>`).join('');
}

function doAction(id) {
  pauseAuto();
  S.target = null;
  S.walking = false;
  const on = S.me.play(id);
  if (on && (id === 'keunjeol' || id === 'banbae')) { bowl(0.4); addRecord('bows', 1); }
  $('#bae-counter').hidden = !(on && id === 'bae108');
  if (on && id === 'bae108') S.me.onBow(0);
  net.sendAct({ a: id, on });
  pushState(true);
  syncActionButtons();
}

// 시간표가 시키는 반복 동작 (발우공양, 독서, 명상)
function startLoop(id) {
  S.me.action = id;
  S.me.actionT = 0;
  pushState(true);
  syncActionButtons();
}

function syncActionButtons() {
  document.querySelectorAll('.act').forEach((b) => b.setAttribute('aria-pressed', String(S.me?.action === b.dataset.act)));
  if (S.me?.action !== 'bae108') $('#bae-counter').hidden = true;
}

// ───────── 시간표 ─────────
function currentBlock(now = new Date()) {
  const sc = S.schedule;
  const day = now.getDay();
  if (sc.weekendOff && (day === 0 || day === 6)) return null;
  const m = now.getHours() * 60 + now.getMinutes();
  return sc.blocks.find((b) => toMin(b.start) <= m && m < toMin(b.end)) || null;
}

function nextBlock(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  return [...S.schedule.blocks].sort((a, b) => toMin(a.start) - toMin(b.start)).find((b) => toMin(b.start) > m) || null;
}

// 직접 움직이면 시간표는 다음 칸이 시작될 때까지 쉰다
function pauseAuto() {
  if (S.autoAct) { S.autoAct = null; updateSchedChip(); }
  S.walking = false;
  walkStarting = false;
}

async function applyActivity(act) {
  const def = ACTIVITIES[act];
  if (!def || !def.scene || S.mode !== 'world') return;
  S.autoAct = act;
  if (S.scene !== def.scene) await goScene(def.scene);
  if (S.autoAct !== act) return;
  if (act === 'walk') startWalk();
  if (act === 'meal') { const s = freeSeat(S.active.seats); if (s && sitOn(s, { auto: true })) startLoop('eat'); }
  if (act === 'read') { if (S.seat == null) sitOn(S.active.seats[0], { auto: true }); startLoop('read'); }
  if (act === 'pray') { const s = freeSeat(S.active.seats); if (s && sitOn(s, { auto: true })) startLoop('meditate'); }
  updateSchedChip();
}

function startWalk() {
  const path = S.active.walkPath;
  if (!path) return;
  standUp(true);
  const p = S.me.group.position;
  let i = 0, best = Infinity;
  path.forEach((w, k) => { const d = w.distanceTo(p); if (d < best) { best = d; i = k; } });
  S.walking = true;
  const go = (k) => {
    if (!S.walking) return;
    S.target = { pos: path[k], speed: 1.5, onArrive: () => go((k + 1) % path.length) };
  };
  go(i);
}

function schedTick() {
  if (S.mode !== 'world') return;
  const b = currentBlock();
  const key = b ? `${b.start}-${b.end}-${b.act}` : 'free';
  if (key !== S.blockKey) {
    const first = S.blockKey === undefined;
    S.blockKey = key;
    // 처음 들어올 때는 법당에 두고, 아래 작은 단추(예: '내 방으로')로 일정을 따라가요
    if (!first) {
      if (b) {
        toast(`${b.start} · ${b.label || ACTIVITIES[b.act].name} 시간이에요`);
        if (S.schedule.auto) applyActivity(b.act);
      } else if (S.autoAct) {
        S.autoAct = null;
        S.walking = false;
        S.target = null;
      }
    }
  }
  updateSchedChip();
}
setInterval(schedTick, 5000);


function updateSchedChip() {
  const b = currentBlock();
  const n = nextBlock();
  $('#sched-now').textContent = b ? `지금 · ${b.label || ACTIVITIES[b.act].name} ${b.start}–${b.end}` : n ? `다음 · ${n.start} ${n.label || ACTIVITIES[n.act].name}` : '오늘 일정 끝';
  $('#sched-cap').textContent = !S.schedule.auto ? '자동으로 움직이기 꺼짐 · 눌러서 고치기' : S.autoAct ? '하루 일정대로 움직이는 중 · 눌러서 고치기' : '눌러서 하루 일정 고치기';
}

function renderSchedEditor(draft) {
  $('#sched-auto').checked = draft.auto;
  $('#sched-weekend').checked = draft.weekendOff;
  const opts = (sel) => Object.entries(ACTIVITIES).filter(([k]) => k !== 'free').map(([k, a]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${a.name}</option>`).join('');
  $('#sched-rows').innerHTML = draft.blocks.map((b, i) => `
    <div class="sched-row" data-i="${i}">
      <input type="time" value="${b.start}" data-k="start" aria-label="시작">
      <span>–</span>
      <input type="time" value="${b.end}" data-k="end" aria-label="끝">
      <select data-k="act" aria-label="할 일">${opts(b.act)}</select>
      <input type="text" value="${escapeHtml(b.label || '')}" data-k="label" maxlength="12" placeholder="이름" aria-label="이름">
      <button type="button" class="icon-btn" data-del="${i}" aria-label="지우기"><span class="lbl">✕</span><small class="cap">지우기</small></button>
    </div>`).join('');
  renderTimeline(draft);
}

function renderTimeline(draft) {
  const now = new Date();
  const nowPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  const segs = draft.blocks.map((b) => {
    const a = toMin(b.start), e = toMin(b.end);
    if (!(e > a)) return '';
    return `<i style="left:${(a / 1440) * 100}%;width:${((e - a) / 1440) * 100}%;background:${ACTIVITIES[b.act]?.color}" title="${b.start}–${b.end}"></i>`;
  }).join('');
  const ticks = [0, 6, 12, 18, 24].map((h) => `<span style="left:${(h / 24) * 100}%">${h}시</span>`).join('');
  const legend = Object.entries(ACTIVITIES).filter(([k]) => k !== 'free').map(([, a]) => `<span><b style="background:${a.color}"></b>${a.name}</span>`).join('');
  $('#timeline').innerHTML = `<div class="tl-bar">${segs}<em style="left:${nowPct}%"></em></div><div class="tl-ticks">${ticks}</div><div class="tl-legend">${legend}</div>`;
}

let schedDraft = null;
function openSched() {
  schedDraft = structuredClone(S.schedule);
  renderSchedEditor(schedDraft);
  $('#sched-modal').hidden = false;
}

$('#sched-rows').addEventListener('input', (e) => {
  const row = e.target.closest('.sched-row');
  if (!row) return;
  schedDraft.blocks[+row.dataset.i][e.target.dataset.k] = e.target.value;
  renderTimeline(schedDraft);
});
$('#sched-auto').onchange = (e) => (schedDraft.auto = e.target.checked);
$('#sched-weekend').onchange = (e) => (schedDraft.weekendOff = e.target.checked);
$('#sched-add').onclick = () => {
  const last = schedDraft.blocks[schedDraft.blocks.length - 1];
  const start = last ? last.end : '09:00';
  const end = `${pad(Math.min(23, +start.slice(0, 2) + 1))}:${start.slice(3)}`;
  schedDraft.blocks.push({ start, end, act: 'pray', label: '' });
  renderSchedEditor(schedDraft);
};
$('#sched-reset').onclick = () => { schedDraft = structuredClone(DEFAULT_SCHEDULE); renderSchedEditor(schedDraft); };
$('#sched-save').onclick = () => {
  const bad = schedDraft.blocks.find((b) => !b.start || !b.end || toMin(b.end) <= toMin(b.start));
  if (bad) return toast('끝나는 시간이 시작 시간보다 뒤여야 해요');
  schedDraft.blocks.sort((a, b) => toMin(a.start) - toMin(b.start));
  S.schedule = schedDraft;
  store.set('schedule', S.schedule);
  $('#sched-modal').hidden = true;
  S.blockKey = null; // 저장하면 지금 칸을 새로 적용
  schedTick();
  toast('하루 일정을 저장했어요');
};

// ───────── 기록 (이 기기에만) ─────────
function addRecord(k, v) {
  const key = `rec:${today()}`;
  const r = store.get(key, {});
  r[k] = (r[k] || 0) + v;
  store.set(key, r);
  const days = store.get('recdays', []);
  if (!days.includes(today())) { days.push(today()); store.set('recdays', days.slice(-120)); }
}

function openRecords() {
  const t = store.get(`rec:${today()}`, {});
  const m = (s) => fmtLong(s || 0);
  const tiles = [['산보·마당', m(t.out)], ['법당', m(t.in)], ['발우공양', m(t.meal)], ['독서', m(t.room)], ['절', `${t.bows || 0}번`], ['소원', `${t.wishes || 0}개`]];
  $('#record-today').innerHTML = `<p class="muted small">오늘 ${today()}</p>` + tiles.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('');
  const days = store.get('recdays', []).slice(-14).reverse();
  const mm = (s) => Math.round((s || 0) / 60);
  $('#record-table').innerHTML = `<thead><tr><th>날짜</th><th>산보</th><th>법당</th><th>공양</th><th>독서</th><th>절</th><th>소원</th></tr></thead><tbody>` +
    (days.length ? days.map((d) => { const r = store.get(`rec:${d}`, {}); return `<tr><td>${d.slice(5)}</td><td>${mm(r.out)}분</td><td>${mm(r.in)}분</td><td>${mm(r.meal)}분</td><td>${mm(r.room)}분</td><td>${r.bows || 0}</td><td>${r.wishes || 0}</td></tr>`; }).join('')
      : '<tr><td colspan="7">아직 기록이 없어요. 머무는 동안 10초마다 쌓여요.</td></tr>') + '</tbody>';
  $('#record-modal').hidden = false;
}

// 10초마다 머문 장소와 누적 시간을 기록
setInterval(() => {
  if (S.mode !== 'world' || !S.loc || document.hidden) return;
  addRecord(S.scene, 10);
  const key = `stay:${S.loc.id}`;
  store.set(key, store.get(key, 0) + 10);
}, 10000);

// ───────── 소원과 연등 ─────────
const LANTERN_COLORS = ['#f08aa0', '#f2c45a', '#f6f2e8', '#9ad0a8', '#9cc0f0', '#f2a05a'];
const LANTERN_NAMES = ['분홍', '노랑', '하양', '연두', '하늘', '주황'];
const AMOUNTS = [{ v: 0, t: '마음만' }, { v: 1000, t: '1,000원' }, { v: 3000, t: '3,000원' }, { v: 10000, t: '10,000원' }];
let wishColor = LANTERN_COLORS[0], wishAmount = 0;

function addWish(w, { animate = false, announce = false } = {}) {
  if (!w || !w.id || S.wishes.some((x) => x.id === w.id)) return;
  S.wishes.push({ id: String(w.id), n: String(w.n).slice(0, 12), t: String(w.t).slice(0, 80), c: LANTERN_COLORS.includes(w.c) ? w.c : LANTERN_COLORS[0], v: w.v | 0 });
  if (S.wishes.length > 60) S.wishes.shift();
  if (announce && S.mode === 'world') toast(`${w.n}님이 복전함에 소원을 올렸어요`);
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
  if (animate) { l.position.set(0, 1.4, -8.4); l.userData.rise = { from: l.position.clone(), to: dest, t: 0 }; }
  else l.position.copy(dest);
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
  if (S.scene !== 'in') return;
  pauseAuto();
  const spot = new THREE.Vector3(0, 0, -7.1);
  if (S.me.group.position.distanceTo(spot) > 1.2) {
    standUp();
    S.target = { pos: spot, face: Math.PI, onArrive: () => { $('#wish-modal').hidden = false; $('#wish-text').focus(); } };
    return;
  }
  $('#wish-modal').hidden = false;
  $('#wish-text').focus();
}

const flyers = [];
function submitWish(e) {
  e.preventDefault();
  const text = $('#wish-text').value.trim();
  if (!text) return;
  $('#wish-modal').hidden = true;
  $('#wish-text').value = '';
  const w = { id: `${net.selfId || 'local'}-${Date.now().toString(36)}`, n: S.profile.name, t: text, c: wishColor, v: wishAmount };
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), new THREE.MeshStandardMaterial({ color: '#fbf3dc', side: THREE.DoubleSide }));
  const start = S.me.group.position.clone().add(new THREE.Vector3(0, 1.0, -0.3));
  paper.position.copy(start);
  S.active.group.add(paper);
  flyers.push({ obj: paper, from: start, to: new THREE.Vector3(0, 1.25, -8.4), t: 0, dur: 0.9, done: () => {
    paper.removeFromParent();
    coin();
    addWish(w, { animate: true });
    net.sendWish(w);
    addRecord('wishes', 1);
    const mine = store.get('mywishes', []);
    mine.unshift({ ...w, place: S.loc.name, at: Date.now() });
    store.set('mywishes', mine.slice(0, 100));
    toast(wishAmount ? `소원과 함께 ${AMOUNTS.find((a) => a.v === wishAmount).t}을 마음으로 시주했어요` : '소원이 연등이 되어 걸렸어요');
  } });
  S.me.play('hapjang');
  pushState(true);
}

function renderWishForm() {
  $('#wish-colors').innerHTML = LANTERN_COLORS.map((c, i) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" aria-pressed="${c === wishColor}" aria-label="${LANTERN_NAMES[i]} 연등" title="${LANTERN_NAMES[i]} 연등"></button>`).join('');
  $('#wish-amounts').innerHTML = AMOUNTS.map((a) => `<button type="button" class="chip" data-v="${a.v}" aria-pressed="${a.v === wishAmount}"><span class="lbl">${a.t}</span><small class="cap">${a.v ? '가상 금액 · 실제 결제 없음' : '시주 없이 소원만'}</small></button>`).join('');
}

// ───────── 알림 ─────────
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3600);
}

// ───────── 화면 위 정보 ─────────
function renderSceneBar() {
  $('#scene-bar').innerHTML = Object.entries(SCENES).map(([k, s]) =>
    `<button data-scene="${k}" aria-pressed="${S.scene === k}"><span class="lbl">${s.name}</span><small class="cap">${s.cap}</small></button>`).join('');
}

function updateHud() {
  if (!S.loc || S.mode !== 'world') return;
  $('#hud-place').textContent = `큰법당 · ${S.loc.name}`;
  $('#design-name').textContent = S.loc.name;
  $('#hud-server').textContent = S.server ? `· 서버 ${S.server}` : '· 서버 찾는 중';
  const here = S.scene === 'room' ? 1 : [...S.remotes.values()].filter((r) => r.st.s === S.scene).length + 1;
  $('#hud-people').textContent = `함께 ${S.remotes.size + 1}명 · ${SCENES[S.scene].name} ${here}명`;
  // 오른쪽 상황 단추는 장소마다 두 개: 법당 [내 방으로][일어서기] · 마당 [법당으로][산보하기]
  // 공양간 [법당으로][일어서기] · 내 방 [법당으로][족자 고르기]
  $('#btn-go .lbl').textContent = S.scene === 'in' ? '내 방으로' : '법당으로';
  $('#btn-stand').hidden = S.seat == null || !['in', 'meal'].includes(S.scene);
  $('#jump-btn').hidden = !canRun(); // 휴대폰 점프 단추: 점프할 수 있는 곳(마당·내 방)에서만
  $('#btn-walk').hidden = S.scene !== 'out';
  $('#btn-scroll').hidden = S.scene !== 'room';
  document.querySelectorAll('#scene-bar button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scene === S.scene)));
}

function updateContext() {
  if (S.mode !== 'world' || !S.active) return;
  const p = S.me.group.position;
  $('#btn-wish').hidden = !(S.scene === 'in' && p.distanceTo(new THREE.Vector3(0, 0, -8.4)) < 3.4);
  const walkLbl = S.walking || walkStarting ? '산보 멈추기' : '산보하기';
  if ($('#btn-walk .lbl').textContent !== walkLbl) $('#btn-walk .lbl').textContent = walkLbl;
}

let timerTick = 1;
function updateTimer(dt) {
  if (S.mode !== 'world') return;
  timerTick += dt;
  if (timerTick < 1) return;
  timerTick = 0;
  const now = new Date();
  $('#hud-timer').innerHTML = `<b>${pad(now.getHours())}:${pad(now.getMinutes())}</b><small>머문 시간 ${fmtTime((Date.now() - S.enteredAt) / 1000)}</small>`;
  // 누적 시간은 관리자에게만
  $('#hud-timer').title = document.body.classList.contains('admin') ? `${S.loc.name}에 머문 시간 모두 ${fmtLong(store.get(`stay:${S.loc.id}`, 0))}` : '머문 시간';
}

// ───────── 서버 ─────────
function renderServerGrid() {
  if (!S.loc) return;
  const counts = net.counts();
  $('#server-title').textContent = '큰법당 서버';
  $('#server-now').textContent = S.server ? `현재 · 큰법당 서버 ${S.server}` : '서버를 찾는 중이에요';
  let html = '';
  for (let i = 1; i <= SERVER_COUNT; i++) {
    const c = counts[i] || 0;
    const cur = i === S.server, full = c >= SERVER_CAP && !cur;
    html += `<button class="server${cur ? ' current' : ''}${full ? ' full' : ''}" data-server="${i}" ${full ? 'disabled' : ''}>
      <b>큰법당 서버 ${i}</b><span>${c} / ${SERVER_CAP}명${cur ? ' · 이용 중' : full ? ' · 만석' : ''}</span>
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
  toast(`큰법당 서버 ${n}에 들어왔어요`);
}

// 자리가 남은 서버 중 가장 붐비는 곳으로
function pickServer() {
  const counts = net.counts();
  let best = 1, bestC = -1;
  for (let i = 1; i <= SERVER_COUNT; i++) {
    const c = counts[i] || 0;
    if (c < SERVER_CAP && c > bestC) { best = i; bestC = c; }
  }
  return best;
}

// ───────── 로딩 ─────────
const QUOTES = [
  '천천히 걸어도 산은 그 자리에 있어요.',
  '밥 한 그릇에도 많은 손이 닿아 있어요.',
  '숨을 한 번 고르면 마음도 한 칸 내려앉아요.',
  '오늘 할 일은 오늘의 나에게 맡겨요.',
  '조용한 곳에서는 작은 소리도 잘 들려요.',
];
// 로딩 뒤 3D 풍경 네 가지 중 하나가 무작위로 나온다 (?loading=1~4 로 고정). 글씨는 모두 같다
const LOADING_VIEWS = [
  // 1 두물정사: 마당 위를 크게 돌며 산과 강을 둘러본다
  { at: () => ['river', 'out'], cam: (t) => { const a = t * 0.05; camera.position.set(Math.sin(a) * 26, 14, Math.cos(a) * 26 + 6); camera.lookAt(Math.sin(a + 2.6) * 60, -8, Math.cos(a + 2.6) * 60 + 40); } },
  // 2 숲울림당: 마당을 낮게 한 바퀴, 법당과 탑이 번갈아 지나간다
  { at: () => ['forest', 'out'], cam: (t) => { const a = t * 0.06; camera.position.set(Math.sin(a) * 19, 5, Math.cos(a) * 19 - 2); camera.lookAt(0, 3.5, -5); } },
  // 3 보리암: 금산 바위 위에서 해가 걸린 남해, 까만 섬들을 좌우로 천천히
  { at: () => ['sea', 'boriam'], cam: (t) => { const a = Math.sin(t * 0.04) * 0.35; camera.position.set(Math.sin(a) * 4, 14, -4); camera.lookAt(Math.sin(a) * 300, -120, 900); } },
  // 4 법당 안: 들어갈 법당 문 앞에서 부처님 쪽으로 천천히 다가간다
  { at: (locId) => [locId, 'in'], cam: (t) => { camera.position.set(Math.sin(t * 0.07) * 2.5, 3.2, 12 - (1 - Math.cos(t * 0.12)) * 3.5); camera.lookAt(0, 3.6, -13); } },
];
const LOADING_N = params.get('loading') ? Math.min(4, Math.max(1, +params.get('loading') || 1)) : 1 + Math.floor(Math.random() * LOADING_VIEWS.length);
const LOADING_VIEW = LOADING_VIEWS[LOADING_N - 1];
let loadP = 0;
function setLoad(p) {
  loadP = Math.max(loadP, p);
  $('#loading').style.setProperty('--p', loadP / 100);
  $('#loading .ld-pct').textContent = `${Math.round(loadP)}%`;
}

function showLoading(locId) {
  S.mode = 'loading';
  $('#loading').hidden = false;
  $('#loading').dataset.view = LOADING_N;
  $('#hud').hidden = true;
  loadP = 0;
  setLoad(3);
  $('#ld-quote').textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  setWorld(worldFor(...LOADING_VIEW.at(locId)));
  if (S.me) S.me.group.visible = false;
}

// ───────── 법당 위치 들어가기 ─────────
async function enterLocation(locId) {
  S.loc = LOCATIONS.find((l) => l.id === locId) || LOCATIONS[0];
  showLoading(S.loc.id);
  for (const id of [...S.remotes.keys()]) removeRemote(id, false);
  const started = performance.now();
  await sleep(60);
  store.set('lastLoc', S.loc.id);
  setLoad(15);
  await sleep(30);
  const hall = worldFor(S.loc.id, 'in');
  setLoad(45);
  // 서버는 디자인과 상관없이 모두 '큰법당 서버 1~12' 하나로 모인다
  const netReady = net.joinLobby('hall', true);
  await Promise.race([loadBuddha(hall), sleep(8000)]);
  setLoad(75);
  await sleep(30);
  worldFor(S.loc.id, 'meal');
  worldFor(S.loc.id, 'room');
  setLoad(88);
  await Promise.race([netReady, sleep(4000)]);
  setLoad(100);
  const min = params.has('hold') ? 1e9 : 2200;
  await sleep(Math.max(0, min - (performance.now() - started)));
  await fade(true);
  S.enteredAt = Date.now();
  S.mode = 'world';
  S.server = 0;
  S.wishes = [];
  S.lanterns.clear();
  S.blockKey = undefined;
  S.autoAct = null;
  makeMe();
  $('#loading').hidden = true;
  await goScene('in', { instant: true });
  $('#hud').hidden = false;
  renderActions();
  renderSceneBar();
  syncActionButtons();
  S.enteredAt = Date.now();
  updateHud();
  schedTick();
  fade(false);
  if (!store.get('welcomed', false)) $('#welcome').hidden = false;
  if (!net.online) { S.server = 1; updateHud(); toast('실시간 연결이 안 돼서 혼자 머무는 중이에요'); return; }
  if (net.mode === 'p2p') await sleep(1500);
  await switchServer(pickServer());
}

// 디자인(건물·배경·마당) 바꾸기: 서버와 함께 있는 사람은 그대로, 내 화면의 풍경만 바뀐다
async function changeDesign(locId) {
  if (S.mode !== 'world' || locId === S.loc?.id) return;
  await fade(true);
  S.loc = LOCATIONS.find((l) => l.id === locId) || LOCATIONS[0];
  store.set('lastLoc', S.loc.id);
  S.lanterns.clear();
  const act = S.autoAct;
  await goScene(S.scene, { instant: true });
  if (act) applyActivity(act);
  updateHud();
  fade(false);
  toast(`${S.loc.name} 디자인으로 바꿨어요`);
}

function showPlaces() {
  $('#places').hidden = false;
  // 아주 단순한 바탕: 하늘색 위 · 땅색 아래 두 칸 + 이름만 (설명 없음)
  const GROUND = { forest: '#6f9070', river: '#8a9cb0', sea: '#4f8db3' };
  $('#place-list').innerHTML = LOCATIONS.map((l) => {
    const cur = S.loc?.id === l.id;
    const art = `background:linear-gradient(to top, ${GROUND[l.id] || '#8f8878'} 0 32%, transparent 32%), linear-gradient(${l.sky[0]}, ${l.sky[1]})`;
    return `<button class="place${cur ? ' current' : ''}" data-place="${l.id}" aria-pressed="${cur}"><span class="place-art" style="${art}"></span><b>${l.name}</b><small>${l.place}</small></button>`;
  }).join('') + '<p class="fine credit">불상 자료 · 국가유산청 금동보살좌상(판불), 국립중앙박물관 3D 데이터 5점(덕수2116·덕수3310·본관5191·M번435·본관14752), 공공누리 제1유형</p>';
}

// ───────── 캐릭터 꾸미기 ─────────
let preview = null, draft = null;
function openCreator() {
  draft = structuredClone(S.profile);
  $('#creator').hidden = false;
  $('#nick').value = draft.name;
  renderCreatorOptions();
  if (!preview) initPreview();
  preview.avatar.setLook(draft.look, 'out');
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
  if (!preview.avatar.action && preview.t > 3) { preview.t = 0; preview.avatar.play(['hapjang', 'wave', 'banbae'][Math.floor(Math.random() * 3)]); }
  preview.avatar.update(dt, ACTIONS);
  preview.ctl.update();
  preview.r.render(preview.sc, preview.cam);
}

function renderCreatorOptions() {
  const L = draft.look;
  $('#opt-gender').innerHTML = GENDERS.map((g) => `<button class="chip" data-gender="${g.id}" aria-pressed="${L.gender === g.id}"><span class="lbl">${g.name}</span><small class="cap">${g.cap}</small></button>`).join('');
  $('#opt-type').innerHTML = CHAR_TYPES.map((t) => `<button class="chip" data-type="${t.id}" aria-pressed="${L.type === t.id}"><span class="lbl">${t.name}</span><small class="cap">${t.desc}</small></button>`).join('');
  $('#opt-skin').innerHTML = SKIN_TONES.map((s, i) => `<button class="swatch" data-skin="${s}" style="background:${s}" aria-pressed="${L.skin === s}" aria-label="${i + 1}번째 색" title="${['가장 밝은', '밝은', '중간', '짙은', '가장 짙은'][i]} 색"></button>`).join('');
  $('#opt-outfit').innerHTML = OUTFITS.filter((o) => !o.hidden).map((o) => `<button class="chip" data-outfit="${o.id}" aria-pressed="${L.outfit === o.id}"><span class="lbl">${o.name}</span><small class="cap">${o.cap}</small></button>`).join('');
  $('#opt-acc').innerHTML = ACCESSORIES.map((a) => `<button class="chip" data-acc="${a.id}" aria-pressed="${L.acc === a.id}"><span class="lbl">${a.name}</span><small class="cap">${a.cap}</small></button>`).join('');
  $('#opt-pet').innerHTML = PETS.filter((p) => !p.hidden).map((p) => `<button class="chip" data-pet="${p.id}" aria-pressed="${(L.pet || 'none') === p.id}"><span class="lbl">${p.name}</span><small class="cap">${p.cap}</small></button>`).join('');
}

function finishCreator() {
  draft.name = $('#nick').value.trim().slice(0, 10) || randomName();
  S.profile = draft;
  store.set('profile', S.profile);
  $('#creator').hidden = true;
  S.me.setLook(S.profile.look, S.scene);
  S.me.setName(S.profile.name);
  pushState(true);
  toast(S.scene === 'in' ? '새 모습으로 바꿨어요. 법당 안에서는 회색 승복을 입어요' : '새 모습으로 바꿨어요');
}

// ───────── 입력 ─────────
const keys = new Set();
addEventListener('keydown', (e) => { if (!e.target.closest('input, textarea, select')) keys.add(e.code); });
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

// 화면 탭: 방석·자리 → 바로 앉기, 복전함 → 소원, 연등 → 소원 읽기, 바닥 → 걸어가기
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || S.mode !== 'world') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const w = S.active;
  for (const h of ray.intersectObjects(w.group.children, true)) {
    const o = h.object;
    if (o.userData.wish) { const wi = o.userData.wish; toast(`“${wi.t}” · ${wi.n}님의 연등`); return; }
    if (o.userData.seats) {
      const seat = w.seats[o.userData.seats === 'room' ? 0 : h.instanceId];
      if (seat) walkToSeat(seat);
      return;
    }
    if (o.userData.donation) return openWish();
    // 불상을 누르면 (휴대폰) ‹ › 버튼이 4초 동안 나온다
    // 불상이나 탑을 누르면 불상·탑 고르기 창
    for (const slot of [w.buddhaSlot, w.pagodaSlot]) if (slot) { let p = o; while (p && p !== slot) p = p.parent; if (p) return openRelics(); }
    if (o.userData.scroll) return openScrolls();
    if (o === w.floor) {
      if (S.me.action && !ACTIONS.find((a) => a.id === S.me.action)?.loop) return;
      pauseAuto();
      standUp();
      // 마당에서 멀리 누르면 뛰어간다
      const far = S.scene === 'out' && h.point.distanceTo(S.me.group.position) > 8;
      S.target = { pos: h.point.clone().setY(0), run: far };
      return;
    }
    if (S.scene === 'out' && h.distance < 60 && Math.abs(h.point.x) < 12 && h.point.z < -1 && h.point.z > -20) {
      pauseAuto();
      S.target = { pos: w.door.clone(), onArrive: () => goScene('in') };
      return;
    }
  }
});

// ───────── 이동 ─────────
const tmpV = new THREE.Vector3();
const SPEED = 2.7;        // 걷는 속도
const SEAT_SPEED = 1.8;   // 자리로 걸어갈 때는 더 천천히
const RUN_SPEED = 5.4;    // 뛰는 속도: 마당과 내 방에서만 (법당·공양간에서는 걷는다)
const canRun = () => S.scene === 'out' || S.scene === 'room';

// 점프: 스페이스 (휴대폰은 오른쪽 아래 ↑ 단추). 뛰기처럼 마당과 내 방에서만
const JUMP_V = 5.2, GRAVITY = 15;
let jumpV = 0, jumpY = 0;
const jumpArc = (t) => JUMP_V * t - 0.5 * GRAVITY * t * t;
function jump() {
  if (S.mode !== 'world' || !canRun() || S.seat != null || jumpY > 0) return;
  jumpV = JUMP_V;
  jumpY = 0.001;
  net.sendAct({ a: 'jump' });
}
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || S.mode !== 'world' || e.target.closest('input, textarea, select')) return;
  e.preventDefault(); // 눌러 둔 버튼이 다시 눌리거나 화면이 내려가지 않게
  if (!e.repeat) jump();
}, true);
$('#jump-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
function moveMe(dt) {
  const me = S.me, g = me.group;
  let dx = 0, dz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  dx += joy.x; dz += joy.y;
  let dir = null, speed = SPEED;
  if (Math.hypot(dx, dz) > 0.15) {
    pauseAuto();
    S.target = null;
    if (S.seat != null) standUp();
    const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    dir = new THREE.Vector3(dx * cos + dz * sin, 0, -dx * sin + dz * cos);
    if (dir.length() > 1) dir.normalize();
    // Shift 를 누르거나 조이스틱을 끝까지 밀면 뛴다
    if (canRun() && (keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.92)) speed = RUN_SPEED;
  } else if (S.target) {
    tmpV.copy(S.target.pos).sub(g.position).setY(0);
    if (tmpV.length() < 0.18) {
      const t = S.target; S.target = null;
      if (t.face != null) g.rotation.y = t.face;
      t.onArrive?.();
    } else { dir = tmpV.normalize(); speed = S.target.run && canRun() ? RUN_SPEED : S.target.speed || SPEED; }
  }
  if (dir && S.me.action && S.me.action !== 'meditate') { S.me.stop(); syncActionButtons(); }
  const before = g.position.clone();
  if (dir) {
    g.position.addScaledVector(dir, speed * dt);
    const want = Math.atan2(dir.x, dir.z);
    const diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
    g.rotation.y += diff * Math.min(1, dt * 10);
    collide(g.position);
    if (S.target && !S.walking && g.position.distanceTo(before) < speed * dt * 0.2) S.target = null;
  }
  me.speed = dir ? g.position.distanceTo(before) / Math.max(dt, 1e-4) : 0;
  const delta = g.position.clone().sub(before).setY(0);
  camera.position.add(delta);
  controls.target.add(delta);

  // 점프: 솟았다가 떨어진다 (카메라는 따라 출렁이지 않게 높이는 빼고 따라온다)
  if (S.seat != null) jumpY = 0;
  if (jumpY > 0) {
    jumpV -= GRAVITY * dt;
    jumpY = Math.max(0, jumpY + jumpV * dt);
    g.position.y = jumpY;
  }
  me.airborne = jumpY > 0;

  // 문으로 드나들기
  const w = S.active;
  if (w.exitZ && S.scene !== 'out' && dir && g.position.z > w.exitZ && Math.abs(g.position.x) < 2.6) goScene('out');
  else if (S.scene === 'out' && dir && !S.walking && g.position.distanceTo(w.door) < 1.3) goScene('in');
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
const galleryAvatars = [];
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  if (S.mode === 'loading') {
    LOADING_VIEW.cam(elapsed);
    S.active?.update?.(elapsed);
  } else if (S.mode === 'world') {
    moveMe(dt);
    stepCameraTurn(dt);
    controls.update();
    S.me.update(dt, ACTIONS);
    if (!S.me.action && document.querySelector('.act[aria-pressed="true"]')) syncActionButtons();
    soundFor(S.me, 1);
    for (const r of S.remotes.values()) {
      const g = r.av.group;
      const before = g.position.clone();
      const target = r.av.seated ? tmpV.copy(r.pos).setY(r.seatY) : r.pos;
      g.position.lerp(target, Math.min(1, dt * 8));
      if (g.position.distanceTo(target) > 6) g.position.copy(target);
      const diff = r.rot - g.rotation.y;
      g.rotation.y += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(1, dt * 8);
      r.av.speed = r.av.seated ? 0 : Math.hypot(g.position.x - before.x, g.position.z - before.z) / Math.max(dt, 1e-4);
      // 다른 분이 점프하면 같은 높이로 솟았다 떨어진다
      if (r.jumpT != null) {
        r.jumpT += dt;
        const jy = jumpArc(r.jumpT);
        if (jy <= 0 || r.av.seated) { r.jumpT = null; jy <= 0 && !r.av.seated && (g.position.y = 0); }
        else g.position.y = jy;
      }
      r.av.airborne = r.jumpT != null;
      if (!g.visible) continue;
      r.av.update(dt, ACTIONS);
      r.av.tag.visible = g.position.distanceTo(camera.position) < 13;
      soundFor(r.av, Math.max(0, 1 - g.position.distanceTo(S.me.group.position) / 16));
    }
    const now = performance.now();
    for (const [id, r] of S.remotes) if (now - r.seen > 20000) removeRemote(id, false);
    pushState();
    updateContext();
    updateTimer(dt);
    S.active.update?.(elapsed);
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

// ───────── 버튼 ─────────
const syncSoundBtn = () => {
  $('#btn-sound .lbl').textContent = sound.on ? '🔊' : '🔈';
  $('#btn-sound .cap').textContent = sound.on ? '소리 끄기' : '소리 켜기';
};

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.close) { $('#' + t.dataset.close).hidden = true; return; }
  if (t.dataset.act) return doAction(t.dataset.act);
  if (t.dataset.scene) { document.body.classList.remove('show-scenes'); pauseAuto(); if (t.dataset.scene !== S.scene) goScene(t.dataset.scene); return; }
  if (t.dataset.place) { $('#places').hidden = true; return changeDesign(t.dataset.place); }
  if (t.dataset.server) { $('#server-modal').hidden = true; return switchServer(+t.dataset.server); }
  if (t.dataset.del != null) { schedDraft.blocks.splice(+t.dataset.del, 1); return renderSchedEditor(schedDraft); }
  const pick = ['type', 'skin', 'outfit', 'acc', 'gender', 'pet'].find((k) => t.dataset[k] != null);
  if (pick && t.closest('#creator')) { draft.look[pick] = t.dataset[pick]; renderCreatorOptions(); preview.avatar.setLook(draft.look, 'out'); return; }
  if (t.dataset.c) { wishColor = t.dataset.c; return renderWishForm(); }
  if (t.dataset.v != null && t.closest('#wish-amounts')) { wishAmount = +t.dataset.v; return renderWishForm(); }
  if (t.dataset.menu) {
    $('#menu').hidden = true;
    const m = t.dataset.menu;
    if (m === 'calm') startCalm();
    if (m === 'char') openCreator();
    if (m === 'sched') openSched();
    if (m === 'record') openRecords();
    if (m === 'scroll') openScrolls();
    if (m === 'relic') openRelics();
    if (m === 'place') showPlaces();
    if (m === 'server') { net.refreshCounts(); renderServerGrid(); $('#server-modal').hidden = false; }
    if (m === 'credit') $('#credit-modal').hidden = false;
    if (m === 'mywish') {
      const list = store.get('mywishes', []);
      $('#mywish-list').innerHTML = list.length ? list.map((w) => `<li>${escapeHtml(w.t)}<small>${escapeHtml(w.place)} · ${new Date(w.at).toLocaleString('ko-KR')}</small></li>`).join('') : '<li>아직 올린 소원이 없어요. 법당 안 복전함 앞에서 올릴 수 있어요.</li>';
      $('#mywish-modal').hidden = false;
    }
  }
});

$('#nick-dice').onclick = () => { $('#nick').value = randomName(); };
$('#creator-done').onclick = finishCreator;
$('#btn-menu').onclick = () => { $('#menu').hidden = !$('#menu').hidden; };
$('#btn-stand').onclick = () => { pauseAuto(); standUp(); };
$('#btn-go').onclick = () => { pauseAuto(); goScene(S.scene === 'in' ? 'room' : 'in'); };
// 산보: 먼저 합장하고, 마당을 오른쪽(시계 방향, 법당을 오른쪽에 두고)으로 계속 돈다. 다시 누르면 멈춘다
let walkStarting = false;
$('#btn-walk').onclick = async () => {
  if (S.walking || walkStarting) { walkStarting = false; pauseAuto(); S.target = null; return; }
  standUp(true);
  doAction('hapjang');
  walkStarting = true;
  await sleep(1800);
  if (!walkStarting) return;
  walkStarting = false;
  if (S.scene === 'out') startWalk();
};
$('#btn-wish').onclick = openWish;
$('#sched-chip').onclick = openSched;
$('#design-chip').onclick = showPlaces;
// 왼쪽 도형 단추
// 위치 단추: 바로 옆에 디자인 이름 3개와 서버 번호만 (설명 · 그림 없이). 고르거나 다른 곳을 누르면 닫혀요
function togglePick() {
  if (!document.body.classList.toggle('show-pick')) return;
  $('#pick-design').innerHTML = LOCATIONS.map((l) => `<button data-place="${l.id}" aria-pressed="${S.loc?.id === l.id}">${l.name}</button>`).join('');
  $('#pick-server').innerHTML = Array.from({ length: SERVER_COUNT }, (_, i) => `<button data-server="${i + 1}" aria-pressed="${S.server === i + 1}">${i + 1}</button>`).join('');
}
$('#side-place').onclick = togglePick;
addEventListener('pointerdown', (e) => { if (!e.target.closest('#pick-pop, #side-place')) document.body.classList.remove('show-pick'); });
$('#pick-pop').addEventListener('click', (e) => { if (e.target.closest('button')) document.body.classList.remove('show-pick'); });
$('#side-char').onclick = openCreator;
$('#side-sched').onclick = openSched;
$('#side-wish').onclick = () => { if (S.scene === 'in') openWish(); else toast('소원은 법당 안 복전함에서 올려요'); };
// 숫자 키 1~8 = 아래 동작 칸 차례대로
addEventListener('keydown', (e) => {
  if (S.mode !== 'world' || e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  const n = /^Digit([1-9])$/.exec(e.code)?.[1];
  const btn = n && document.querySelectorAll('#actions .act')[n - 1];
  if (btn) { e.preventDefault(); btn.click(); }
});
$('#server-chip').onclick = showPlaces;   // 위 왼쪽 칩 하나: 누르면 디자인 고르기 (서버는 메뉴에서)
$('#server-refresh').onclick = () => { net.refreshCounts(); renderServerGrid(); toast('인원을 새로 셌어요'); };
$('#btn-sound').onclick = () => { setSound(!sound.on); store.set('muted', !sound.on); syncSoundBtn(); };

// 크게 보기 (화면보호기): 버튼을 모두 숨기고 전체 화면에서 카메라가 내 캐릭터 둘레를 천천히 돌아요.
// 하루 일정은 그대로 따라가요. 화면을 누르거나 아무 키나 누르면 돌아와요. 5분 동안 손대지 않아도 저절로 켜져요.
const CALM_IDLE = 5 * 60 * 1000;
let lastInput = Date.now();
function startCalm() {
  if (S.calm || S.mode !== 'world') return;
  S.calm = true;
  document.body.classList.add('calm');
  $('#menu').hidden = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  document.documentElement.requestFullscreen?.().catch(() => {});
  toast('화면을 누르면 돌아와요');
}
function stopCalm() {
  if (!S.calm) return;
  S.calm = false;
  document.body.classList.remove('calm');
  controls.autoRotate = false;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
// 크게 보기 중의 첫 누름은 돌아오기만 하고, 걸어가기 같은 다른 일은 하지 않아요
const wake = (e) => {
  lastInput = Date.now();
  if (!S.calm) return;
  e.stopPropagation(); e.preventDefault();
  stopCalm();
};
addEventListener('pointerdown', wake, { capture: true });
addEventListener('keydown', wake, { capture: true });
addEventListener('pointermove', () => { lastInput = Date.now(); }, { passive: true });
addEventListener('wheel', () => { lastInput = Date.now(); }, { passive: true });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) stopCalm(); });
setInterval(() => {
  const busy = !$('#creator').hidden || document.querySelector('.modal:not([hidden])');
  if (!S.calm && S.mode === 'world' && !busy && Date.now() - lastInput > CALM_IDLE) startCalm();
}, 10000);
$('#welcome-char').onclick = () => { $('#welcome').hidden = true; store.set('welcomed', true); openCreator(); };
$('#welcome-sched').onclick = () => { $('#welcome').hidden = true; store.set('welcomed', true); openSched(); };
$('#welcome-close').onclick = () => { $('#welcome').hidden = true; store.set('welcomed', true); };
$('#wish-form').addEventListener('submit', submitWish);
// 소리는 처음 화면을 누를 때 켠다 (브라우저 규칙)
addEventListener('pointerdown', () => { if (!sound.on && !params.has('mute') && !store.get('muted', false)) { setSound(true); syncSoundBtn(); } }, { once: true });
syncSoundBtn();
renderWishForm();

// ───────── 시안용 화면 (?gallery=types|men|outfits|acc|pets, ?demo=in|out|meal|room&loc=..&bots=N) ─────────
function gallery(kind) {
  S.mode = 'gallery';
  $('#loading').hidden = true;
  scene.background = new THREE.Color('#efe6d6');
  scene.add(new THREE.HemisphereLight('#fff7e8', '#b59a7a', 1.5));
  const d = new THREE.DirectionalLight('#ffffff', 2.4); d.position.set(3, 6, 5); d.castShadow = true; scene.add(d);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshStandardMaterial({ color: '#e6d9c2' }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const items = kind === 'types' || kind === 'men' ? CHAR_TYPES.map((t, i) => ({ look: { ...defaultLook(), type: t.id, gender: kind === 'men' ? 'm' : 'f', skin: SKIN_TONES[i % 3], pet: 'none' } }))
    : kind === 'outfits' ? OUTFITS.filter((o) => !o.hidden).map((o, i) => ({ look: { ...defaultLook(), type: CHAR_TYPES[i].id, gender: i % 2 ? 'm' : 'f', outfit: o.id, pet: 'none' } }))
    : kind === 'monk' ? CHAR_TYPES.map((t, i) => ({ look: { ...defaultLook(), type: t.id, gender: i % 2 ? 'm' : 'f', pet: 'none' }, scene: 'in' }))
    : kind === 'pets' ? PETS.filter((p) => !p.hidden && p.id !== 'none').map((p, i) => ({ look: { ...defaultLook(), type: CHAR_TYPES[i % 8].id, gender: i % 2 ? 'm' : 'f', pet: p.id } }))
    : ACCESSORIES.map((a, i) => ({ look: { ...defaultLook(), type: CHAR_TYPES[i].id, gender: i % 2 ? 'm' : 'f', acc: a.id, pet: 'none' } }));
  const acts = (params.get('acts') || '').split(',');
  const gap = kind === 'pets' ? 1.7 : 1.3;
  items.forEach((it, i) => {
    const av = new Avatar(it.look, CHAR_TYPES[i % 8].name);
    if (it.scene) av.dress(it.scene);
    av.group.position.set((i - (items.length - 1) / 2) * gap - (kind === 'pets' ? 0.35 : 0), 0, 0);
    if (acts[i]) av.play(acts[i]);
    if (params.get('speed')) av.speed = +params.get('speed'); // 시안용: 걷기·뛰기 모습 보기
    scene.add(av.group);
    galleryAvatars.push(av);
  });
  camera.fov = 40; camera.updateProjectionMatrix();
  camera.position.set(0, 1.6, kind === 'pets' ? 15 : 9.6);
  camera.lookAt(0, 0.85, 0);
  controls.enabled = false;
}

async function demo(which) {
  S.loc = LOCATIONS.find((l) => l.id === (params.get('loc') || 'forest'));
  S.enteredAt = Date.now() - 754000;
  S.mode = 'world';
  S.server = 6;
  if (params.get('type')) S.profile = { ...S.profile, look: { ...S.profile.look, type: params.get('type') } };
  makeMe();
  $('#loading').hidden = true;
  $('#hud').hidden = params.has('nohud');
  renderActions();
  renderSceneBar();
  await goScene(which, { instant: true });
  if (which === 'in') await loadBuddha(S.active);
  S.enteredAt = Date.now() - 754000;
  const n = +(params.get('bots') || 0);
  const types = CHAR_TYPES.map((t) => t.id);
  const rnd = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const world = S.active;
  const seats = world.seats ? [...world.seats].sort(() => rnd() - 0.5) : [];
  for (let i = 0; i < n; i++) {
    const look = { type: types[Math.floor(rnd() * types.length)], gender: rnd() < 0.5 ? 'f' : 'm', skin: SKIN_TONES[Math.floor(rnd() * 3)], outfit: rnd() < 0.5 ? 'own' : OUTFITS[1 + Math.floor(rnd() * 6)].id, acc: rnd() < 0.7 ? 'none' : ACCESSORIES[Math.floor(rnd() * ACCESSORIES.length)].id, pet: rnd() < 0.35 ? PETS[Math.floor(rnd() * 10)].id : 'none' };
    const seat = (which === 'in' && rnd() < 0.75) || which === 'meal' ? seats[i] : null;
    const walk = which === 'out' && world.walkPath ? world.walkPath[i % world.walkPath.length] : null;
    const pos = seat ? [seat.pos.x, seat.pos.z] : walk ? [walk.x + (rnd() - 0.5) * 2, walk.z + (rnd() - 0.5) * 2] : [(rnd() - 0.5) * 18, (rnd() - 0.3) * 18];
    const act = which === 'meal' ? 'eat' : seat ? ['hapjang', 'beads', 'meditate', 'moktak', null][Math.floor(rnd() * 5)] : null;
    handleRemoteState('bot' + i, { n: randomName(), l: look, s: which, p: pos, r: seat ? seat.rot : rnd() * 6, seat: seat ? seat.id : null, y: seat ? seat.y : 0, a: act, at: rnd() * 2 });
  }
  for (const r of S.remotes.values()) { r.seen = Infinity; r.av.group.position.copy(r.pos); if (r.av.seated) r.av.group.position.y = r.seatY; }
  if (params.get('seat') && world.seats) sitOn(world.seats[+params.get('seat')], { auto: true });
  if (which === 'meal' && !params.get('seat')) { sitOn(freeSeat(world.seats, false), { auto: true }); }
  const act = params.get('act') || (which === 'meal' ? 'eat' : which === 'room' ? 'read' : null);
  if (act) startLoop(act);
  if (which === 'out' && params.has('walk')) startWalk();
  const cam = params.get('cam');
  if (cam) {
    const [x, y, z, tx, ty, tz] = cam.split(',').map(Number);
    camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update();
  }
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  if (params.get('toast')) toast(params.get('toast'));
  if (params.has('sched')) openSched();
  if (params.has('record')) openRecords();
  if (params.has('relic')) openRelics();
  if (params.get('act') === 'bae108') { $('#bae-counter').innerHTML = '<small>108배</small><b>12</b><small>/ 108</small>'; $('#bae-counter').hidden = false; }
  updateHud();
  updateSchedChip();
}

// ───────── 시작 ─────────
$('#relic-b-prev').onclick = () => stepBuddha(-1);
$('#relic-b-next').onclick = () => stepBuddha(1);
$('#relic-p-prev').onclick = () => stepPagoda(-1);
$('#relic-p-next').onclick = () => stepPagoda(1);

(async () => {
  if (!params.has('demo') && !params.has('gallery')) preloadNet();
  try { await Promise.race([document.fonts.load('700 40px "Gowun Batang"'), sleep(2500)]); } catch {}
  loop();
  if (params.get('gallery')) return gallery(params.get('gallery'));
  if (params.get('demo')) return demo(params.get('demo'));
  const loc = params.get('loc') || store.get('lastLoc', 'forest');
  enterLocation(LOCATIONS.some((l) => l.id === loc) ? loc : 'forest');
})();
