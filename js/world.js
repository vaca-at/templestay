// 법당 내부와 외부 풍경. 텍스처는 모두 캔버스로 그려서 외부 이미지 없이 동작한다.
// 좌표: 법당 안에서 불상은 -z 쪽, 입구는 +z 쪽. 밖에서는 법당 건물이 -z 쪽, 경치가 +z 쪽.
import * as THREE from 'three';
import { mat } from './avatar.js';

const FONT_TITLE = '"Gowun Batang", "Nanum Myeongjo", serif';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// 간단한 결정적 난수와 노이즈
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function noise(x, z) {
  return Math.sin(x * 0.05) * Math.cos(z * 0.045) + 0.5 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.13 + 0.7)
    + 0.25 * Math.sin(x * 0.23 + z * 0.17) + 0.12 * Math.cos(x * 0.41 - z * 0.37);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ───────── 텍스처 ─────────
const TEX = {};
function woodFloor(base) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(7);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const y = (i * h) / rows;
      const c = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.06);
      g.fillStyle = c.getStyle();
      g.fillRect(0, y, w, h / rows);
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 14; k++) {
        g.beginPath();
        const yy = y + r() * (h / rows);
        g.moveTo(0, yy);
        g.bezierCurveTo(w * 0.3, yy + (r() - 0.5) * 6, w * 0.6, yy + (r() - 0.5) * 6, w, yy);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, y, w, 2);
      const cut = r() * w;
      g.fillRect(cut, y, 2, h / rows);
    }
  }, [6, 8]);
}

function dancheong(beam = '#2f7d6d', accent = '#c8443a') {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = beam; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#f2e7c9'; g.fillRect(0, 10, w, 4); g.fillRect(0, h - 14, w, 4);
    const cols = ['#c8443a', '#f0c05a', '#3b5aa8', '#f2e7c9', '#2a2a2a'];
    for (let i = 0; i < 4; i++) {
      const cx = 64 + i * 128, cy = h / 2;
      for (let ring = 5; ring > 0; ring--) {
        g.fillStyle = cols[ring % cols.length];
        g.beginPath();
        for (let p = 0; p < 16; p++) {
          const a = (p / 16) * Math.PI * 2;
          const rr = ring * 8 + (p % 2 ? 0 : 5);
          g.lineTo(cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr * 0.9);
        }
        g.closePath(); g.fill();
      }
      g.strokeStyle = '#f2e7c9'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx + 54, 18); g.lineTo(cx + 64, cy); g.lineTo(cx + 54, h - 18); g.stroke();
    }
  }, [1, 1]);
}

function roofTiles() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4d52'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const grd = g.createLinearGradient(x, 0, x + 32, 0);
      grd.addColorStop(0, '#2f3236'); grd.addColorStop(0.5, '#5e6268'); grd.addColorStop(1, '#2f3236');
      g.fillStyle = grd; g.fillRect(x, 0, 32, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
  }, [1, 1]);
}

function lattice(frame = '#7a2e22', paper = '#efe3c4', flower = true) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = paper; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8d5a33'; g.lineWidth = 6;
    const s = 32;
    for (let x = 0; x <= w; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    if (flower) {
      // 꽃살: 격자 교차점마다 작은 꽃
      for (let x = s; x < w; x += s) for (let y = s; y < h * 0.62; y += s) {
        g.fillStyle = '#b8783e';
        for (let p = 0; p < 4; p++) {
          const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
          g.beginPath(); g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 7, 4, a, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#e6b04a'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      }
    }
    g.fillStyle = '#6b4a2e'; g.fillRect(0, h * 0.64, w, h * 0.36);
    g.strokeStyle = frame; g.lineWidth = 18; g.strokeRect(0, 0, w, h);
    g.lineWidth = 10; g.beginPath(); g.moveTo(0, h * 0.64); g.lineTo(w, h * 0.64); g.stroke();
  });
}

// 탱화: 붉은 바탕, 가운데 커다란 광배, 둘레의 보살과 구름 무늬
function taenghwa() {
  return canvasTex(1536, 768, (g, w, h) => {
    const r = rng(42);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#5a1a14'); bg.addColorStop(1, '#3a1410');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // 구름 무늬
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, s = 18 + r() * 40;
      g.fillStyle = ['#2f6b5a', '#3a5c8a', '#c9a24a', '#7a2c22'][i % 4];
      g.globalAlpha = 0.5;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * s * 0.6, y + Math.sin(k) * s * 0.3, s * 0.45, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    // 둘레 인물들
    const figure = (x, y, s, robe, halo) => {
      g.fillStyle = halo; g.beginPath(); g.arc(x, y - s * 1.1, s * 0.75, 0, Math.PI * 2); g.fill();
      g.fillStyle = robe; g.beginPath(); g.moveTo(x - s * 0.9, y + s * 1.6); g.quadraticCurveTo(x, y - s * 0.6, x + s * 0.9, y + s * 1.6); g.fill();
      g.fillStyle = '#e8c9a0'; g.beginPath(); g.arc(x, y - s * 1.1, s * 0.42, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2422'; g.beginPath(); g.arc(x, y - s * 1.38, s * 0.3, Math.PI, 0); g.fill();
    };
    const robes = ['#2f6b5a', '#c9a24a', '#3a5c8a', '#b0462e', '#e8dcc0'];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 12; i++) {
        const x = 90 + i * 124 + (row % 2) * 40;
        if (Math.abs(x - w / 2) < 330) continue;
        figure(x, 160 + row * 210, 34 + row * 4, robes[(i + row) % 5], '#d8a845');
      }
    }
    // 큰 광배
    const cx = w / 2, cy = h * 0.46;
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = ['#e6c15a', '#2f6b5a', '#c8443a', '#3a5c8a', '#e6c15a', '#f2e7c9', '#c8443a'][k];
      g.lineWidth = 14;
      g.beginPath(); g.ellipse(cx, cy, 300 - k * 22, 340 - k * 22, 0, 0, Math.PI * 2); g.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.fillStyle = i % 2 ? '#e6c15a' : '#c8443a';
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 320, cy + Math.sin(a) * 360);
      g.lineTo(cx + Math.cos(a + 0.05) * 360, cy + Math.sin(a + 0.05) * 400);
      g.lineTo(cx + Math.cos(a + 0.1) * 320, cy + Math.sin(a + 0.1) * 360);
      g.fill();
    }
    g.strokeStyle = '#c9a24a'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
  });
}

function signboard(text) {
  return canvasTex(768, 256, (g, w, h) => {
    g.fillStyle = '#2a1d16'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2f7d6d'; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22);
    g.strokeStyle = '#c8443a'; g.lineWidth = 6; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#e8c35a';
    g.font = `700 120px ${FONT_TITLE}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 6);
  });
}

// 창문 너머로 보이는 풍경 그림
function windowView(loc) {
  return canvasTex(512, 512, (g, w, h) => paintView(loc, g, w, h));
}

export function paintView(loc, g, w, h) {
  {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, loc.sky[0]); sky.addColorStop(1, loc.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const r = rng(loc.id.length * 13);
    const layers = loc.id === 'forest' ? ['#9fb59a', '#6f9070', '#486b4c'] : ['#b9c3cf', '#8a9cb0', '#5f7690'];
    layers.forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, h * (0.45 + i * 0.12) - Math.sin(x * 0.02 + i * 2 + r()) * 30 - r() * 12);
      g.lineTo(w, h); g.fill();
    });
    if (loc.id === 'river') {
      g.strokeStyle = '#d7e7f0'; g.lineWidth = 18;
      g.beginPath(); g.moveTo(0, h * 0.86); g.quadraticCurveTo(w * 0.4, h * 0.8, w * 0.5, h * 0.9); g.stroke();
      g.beginPath(); g.moveTo(w, h * 0.84); g.quadraticCurveTo(w * 0.6, h * 0.8, w * 0.5, h * 0.9); g.stroke();
    }
    if (loc.id === 'sea') {
      g.fillStyle = '#4f8db3'; g.fillRect(0, h * 0.7, w, h * 0.3);
      g.fillStyle = '#3d6b55';
      for (let i = 0; i < 5; i++) { const x = r() * w; g.beginPath(); g.ellipse(x, h * 0.71, 30 + r() * 50, 14 + r() * 10, 0, Math.PI, 0); g.fill(); }
    }
    if (loc.id === 'forest') {
      for (let i = 0; i < 60; i++) {
        g.fillStyle = ['#c0552f', '#e0a03a', '#7a8a3a', '#a33b2a'][i % 4];
        g.beginPath(); g.arc(r() * w, h * 0.7 + r() * h * 0.3, 14 + r() * 16, 0, Math.PI * 2); g.fill();
      }
    }
  }
}

function stoneTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = '#9a958c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -32 : 0; x < w; x += 64) {
      g.fillStyle = new THREE.Color('#a8a296').offsetHSL(0, 0, (r() - 0.5) * 0.08).getStyle();
      g.fillRect(x + 2, y + 2, 60, 60);
    }
  }, [8, 8]);
}

// ───────── 공용 소품 ─────────
const gold = () => new THREE.MeshStandardMaterial({ color: '#d6a447', metalness: 0.9, roughness: 0.3 });

export function buildBuddha() {
  const g = new THREE.Group();
  const m = gold();
  const add = (geo, sx, sy, sz, x, y, z, material = m) => {
    const o = new THREE.Mesh(geo, material); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o;
  };
  const S = new THREE.SphereGeometry(1, 40, 28);
  // 연화대좌
  add(new THREE.CylinderGeometry(1.3, 1.45, 0.35, 8), 1, 1, 1, 0, 0.17, 0);
  for (let ring = 0; ring < 2; ring++) {
    const n = 16 - ring * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.2;
      const p = add(S, 0.22, 0.32, 0.12, Math.sin(a) * (1.15 - ring * 0.18), 0.55 + ring * 0.12, Math.cos(a) * (1.15 - ring * 0.18));
      p.rotation.y = a; p.rotation.x = 0.5 - ring * 0.3;
    }
  }
  add(new THREE.CylinderGeometry(1.15, 1.0, 0.25, 32), 1, 1, 1, 0, 0.72, 0);
  // 결가부좌한 다리, 몸, 어깨
  add(S, 1.05, 0.34, 0.68, 0, 1.0, 0.12);
  add(S, 0.62, 0.86, 0.46, 0, 1.75, 0);
  add(S, 0.7, 0.3, 0.42, 0, 2.3, -0.02);
  // 팔: 왼손은 무릎 위, 오른손은 무릎 아래로 (항마촉지인)
  const arm = (side, reach) => {
    const a = add(new THREE.CapsuleGeometry(0.17, 0.62, 6, 12), 1, 1, 1, 0.62 * side, 1.8, 0.05);
    a.rotation.z = 0.28 * side; a.rotation.x = -0.3;
    const f = add(new THREE.CapsuleGeometry(0.14, 0.5, 6, 12), 1, 1, 1, 0.5 * side, 1.25, 0.42 + reach);
    f.rotation.x = -1.2; f.rotation.z = -0.2 * side;
    add(S, 0.14, 0.09, 0.2, 0.22 * side + (reach ? 0.35 * side : 0), 1.1 - reach * 0.8, 0.62 + reach * 0.3);
  };
  arm(1, 0);
  arm(-1, 0.18);
  // 목, 머리, 육계, 귀
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.22, 20), 1, 1, 1, 0, 2.55, 0);
  add(S, 0.43, 0.5, 0.44, 0, 2.95, 0.02);
  const curls = new THREE.MeshStandardMaterial({ color: '#3b3a6a', metalness: 0.5, roughness: 0.5 });
  add(S, 0.44, 0.38, 0.44, 0, 3.12, -0.03, curls);
  add(S, 0.22, 0.22, 0.22, 0, 3.48, -0.02, curls);
  add(S, 0.07, 0.24, 0.08, 0.43, 2.82, 0.0);
  add(S, 0.07, 0.24, 0.08, -0.43, 2.82, 0.0);
  const line = new THREE.MeshStandardMaterial({ color: '#7a5420', metalness: 0.6, roughness: 0.5 });
  add(S, 0.09, 0.015, 0.02, 0.15, 2.98, 0.43, line);
  add(S, 0.09, 0.015, 0.02, -0.15, 2.98, 0.43, line);
  add(S, 0.03, 0.03, 0.02, 0, 3.08, 0.44, new THREE.MeshStandardMaterial({ color: '#f5f0e0', emissive: '#ffe8a0', emissiveIntensity: 0.6 }));
  // 가사 주름 띠
  const fold = add(new THREE.TorusGeometry(0.5, 0.035, 8, 32, Math.PI), 1, 1.3, 1, 0.05, 1.95, 0.3);
  fold.rotation.z = -0.6;
  return g;
}

function mandorla(color = '#d6a447') {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-2.6, 0.4, -2.8, 4.2, 0, 6.2);
  shape.bezierCurveTo(2.8, 4.2, 2.6, 0.4, 0, 0);
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
  g.add(outer);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48), new THREE.MeshStandardMaterial({ color: '#b5392e', metalness: 0.3, roughness: 0.5 }));
  inner.position.set(0, 4.25, 0.02);
  g.add(inner);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 48), outer.material);
  ring.position.copy(inner.position);
  g.add(ring);
  return g;
}

export function buildLantern(color = '#f08aa0', glow = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55 * glow, roughness: 0.6 });
  const petal = new THREE.SphereGeometry(1, 10, 8);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), m);
  core.scale.y = 0.85;
  g.add(core);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = new THREE.Mesh(petal, m);
    p.scale.set(0.09, 0.2, 0.06);
    p.position.set(Math.sin(a) * 0.24, 0.02, Math.cos(a) * 0.24);
    p.rotation.y = a; p.rotation.x = -0.5;
    g.add(p);
  }
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.6, 4), mat('#3a2a20'));
  string.position.y = 1.0;
  g.add(string);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.4), mat('#f7f0dc', { side: THREE.DoubleSide }));
  tag.position.y = -0.48;
  g.add(tag);
  return g;
}

function stoneLantern() {
  const g = new THREE.Group();
  const s = mat('#9b958a');
  const add = (geo, y) => { const o = new THREE.Mesh(geo, s); o.position.y = y; o.castShadow = o.receiveShadow = true; g.add(o); };
  add(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 8), 0.15);
  add(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), 1.0);
  add(new THREE.CylinderGeometry(0.55, 0.4, 0.25, 8), 1.8);
  const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#8e897f', emissive: '#ffb860', emissiveIntensity: 0.25 }));
  fire.position.y = 2.2; g.add(fire);
  add(new THREE.ConeGeometry(0.75, 0.45, 8), 2.72);
  add(new THREE.SphereGeometry(0.14, 10, 8), 3.0);
  return g;
}

function pagoda(levels = 3) {
  const g = new THREE.Group();
  const s = mat('#a59f94');
  let y = 0;
  const add = (w, h, d = w) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), s); o.position.y = y + h / 2; o.castShadow = o.receiveShadow = true; g.add(o); y += h; };
  add(3, 0.5); add(2.6, 0.6); add(2.0, 0.35);
  for (let i = 0; i < levels; i++) {
    const w = 1.5 - i * 0.25;
    add(w, 1.1 - i * 0.2);
    add(w + 1.0, 0.18); add(w + 0.6, 0.18);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 8), mat('#7c766c'));
  top.position.y = y + 0.4; g.add(top);
  return g;
}

// ───────── 한옥 지붕 ─────────
// 우진각+팔작 느낌: 용마루가 있는 사면 지붕, 처마 곡선과 귀솟음
function roofGeometry(W, D, H, ridge = 0.45, n = 44) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const u = (i / n) * 2 - 1, v = (j / n) * 2 - 1;
    const x = u * W, z = v * D;
    const a = Math.max(0, (Math.abs(u) - ridge) / (1 - ridge));
    const m = Math.max(a, Math.abs(v));
    let y = H * Math.pow(1 - m, 1.5);
    y += 0.35 * Math.pow(Math.abs(u), 4) * m;                 // 처마 양끝이 살짝 들림 (앙곡)
    y += 0.6 * Math.pow(Math.abs(u) * Math.abs(v), 6);         // 추녀 끝 귀솟음
    pos.push(x, y, z);
    uv.push(x * 0.5, z * 0.35 + y * 0.2);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// 법당 건물 (밖에서 보는 모습). 앞면이 +z
export function buildHallBuilding(loc) {
  const c = loc.interior;
  const g = new THREE.Group();
  const W = 14, D = 8, colH = 4.2;
  const stone = mat('#a39d92');
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 2.4, 1.0, D + 2.4), stone);
  base.position.y = 0.5; base.receiveShadow = base.castShadow = true; g.add(base);
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(4, 0.33, 0.7), stone);
    step.position.set(0, 0.17 + i * 0.33, D / 2 + 1.2 + 0.7 * (2 - i) + 0.35);
    step.position.y = 1.0 - 0.33 * (i + 0.5);
    step.position.z = D / 2 + 1.2 + 0.35 + i * 0.7;
    step.castShadow = step.receiveShadow = true;
    g.add(step);
  }
  const pillarMat = mat(c.pillar);
  const xs = [-W / 2, -W / 6, W / 6, W / 2];
  for (const z of [-D / 2, D / 2]) for (const x of xs) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, colH, 16), pillarMat);
    p.position.set(x, 1 + colH / 2, z); p.castShadow = true; g.add(p);
  }
  // 벽과 꽃살문
  const doorTex = lattice(c.pillar);
  const wallMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.8 });
  for (let k = 0; k < 3; k++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(W / 3 - 0.6, colH - 0.4), wallMat);
    d.position.set(-W / 3 + k * (W / 3), 1 + colH / 2 - 0.1, D / 2 - 0.05);
    g.add(d);
  }
  const plaster = mat('#e9dfc8');
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, colH, 0.3), plaster); back.position.set(0, 1 + colH / 2, -D / 2); g.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, colH, D), plaster); side.position.set(s * W / 2, 1 + colH / 2, 0); side.castShadow = true; g.add(side);
  }
  // 단청 들보
  const dc = dancheong(c.beam, c.accent);
  dc.wrapS = THREE.RepeatWrapping; dc.repeat.set(4, 1);
  const beamMat = new THREE.MeshStandardMaterial({ map: dc, roughness: 0.7 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.8, D + 0.8), beamMat);
  beam.position.y = 1 + colH + 0.4; g.add(beam);
  // 지붕
  const roofGeo = roofGeometry(W / 2 + 2.6, D / 2 + 2.4, 3.4);
  const tiles = roofTiles(); tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 }));
  roof.position.y = 1 + colH + 0.75; roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
  const under = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: c.beam, side: THREE.BackSide, roughness: 0.9 }));
  under.position.y = roof.position.y - 0.06; g.add(under);
  const ridgeLen = (W / 2 + 2.6) * 2 * 0.45;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(ridgeLen, 0.45, 0.5), mat('#3a3d42'));
  ridge.position.y = roof.position.y + 3.4 + 0.15; ridge.castShadow = true; g.add(ridge);
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.5), mat('#3a3d42'));
    end.position.set(s * ridgeLen / 2, ridge.position.y + 0.2, 0); end.rotation.z = -0.3 * s; g.add(end);
  }
  // 현판
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.07), new THREE.MeshStandardMaterial({ map: signboard(loc.name), roughness: 0.6 }));
  sign.position.set(0, 1 + colH + 0.45, D / 2 + 0.42); g.add(sign);
  // 입구 앞 등
  const l1 = stoneLantern(); l1.position.set(-3.5, 0, D / 2 + 4.6); g.add(l1);
  const l2 = stoneLantern(); l2.position.set(3.5, 0, D / 2 + 4.6); g.add(l2);
  g.userData.door = new THREE.Vector3(0, 0, D / 2 + 3.6);
  g.userData.footprint = { w: W / 2 + 1.6, d: D / 2 + 1.3 };
  return g;
}

function skyDome(top, bottom) {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.6, h)), 1.0); }',
  });
  return new THREE.Mesh(geo, m);
}

// ───────── 내부 ─────────
export function buildInterior(loc) {
  const c = loc.interior;
  const g = new THREE.Group();
  // 불상 쪽(뒤) 16, 입구 쪽(앞) 20. 방석 100개가 들어가도록 앞으로 길게 늘였다
  const HW = 13, HD = 16, HF = 20, CEIL = 9;
  const L = HD + HF, ZC = (HF - HD) / 2;

  const floorTex = woodFloor(c.floor);
  floorTex.repeat.set(6, 9);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, L), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = ZC; floor.receiveShadow = true; g.add(floor);

  // 벽: 아래는 나무 판벽, 위는 회벽. 양옆 벽에는 창호
  const plaster = new THREE.MeshStandardMaterial({ color: c.wall, roughness: 0.95 });
  const wood = mat('#5a3826');
  const wall = (w, h, x, y, z, ry, material = plaster) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m;
  };
  wall(HW * 2, CEIL, 0, CEIL / 2, -HD, 0);
  wall(HW * 2, CEIL, 0, CEIL / 2, HF, Math.PI);
  wall(L, CEIL, -HW, CEIL / 2, ZC, Math.PI / 2);
  wall(L, CEIL, HW, CEIL / 2, ZC, -Math.PI / 2);
  wall(L, 1.2, -HW + 0.02, 0.6, ZC, Math.PI / 2, wood);
  wall(L, 1.2, HW - 0.02, 0.6, ZC, -Math.PI / 2, wood);
  wall(HW * 2, 1.2, 0, 0.6, HF - 0.02, Math.PI, wood);

  const viewTex = windowView(loc);
  const viewMat = new THREE.MeshBasicMaterial({ map: viewTex });
  const frameTex = lattice(c.pillar, 'rgba(0,0,0,0)', false);
  const frameMat = new THREE.MeshStandardMaterial({ map: frameTex, transparent: true, alphaTest: 0.4 });
  for (const s of [-1, 1]) for (const z of [-8, 0, 8, 16]) {
    const v = wall(4.6, 4.0, s * (HW - 0.03), 4.2, z, -s * Math.PI / 2, viewMat);
    const f = wall(4.6, 4.0, s * (HW - 0.06), 4.2, z, -s * Math.PI / 2, frameMat);
    v.receiveShadow = f.receiveShadow = false;
  }
  // 입구 문 (밖으로 나가는 곳)
  const doorTex = lattice(c.pillar);
  const exitDoor = wall(5, 5, 0, 2.5, HF - 0.05, Math.PI, new THREE.MeshStandardMaterial({ map: doorTex, emissive: '#ffe9c0', emissiveIntensity: 0.15 }));

  // 기둥과 들보
  const pillarMat = mat(c.pillar);
  const dc = dancheong(c.beam, c.accent); dc.wrapS = THREE.RepeatWrapping; dc.repeat.set(5, 1);
  const beamMat = new THREE.MeshStandardMaterial({ map: dc, roughness: 0.7 });
  const PZ = [-12, -3, 6, 15];
  for (const x of [-11.7, 11.7]) for (const z of PZ) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, CEIL, 18), pillarMat);
    p.position.set(x, CEIL / 2, z); p.castShadow = true; g.add(p);
  }
  for (const z of PZ) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.9, 0.7), beamMat); b.position.set(0, CEIL - 0.6, z); g.add(b);
  }
  for (const x of [-11.7, 11.7]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, L), beamMat); b.position.set(x, CEIL - 0.6, ZC); g.add(b);
  }
  // 우물천장
  const ceilTex = canvasTex(256, 256, (cg, w, h) => {
    cg.fillStyle = c.beam; cg.fillRect(0, 0, w, h);
    cg.fillStyle = '#f2e7c9'; cg.fillRect(10, 10, w - 20, h - 20);
    cg.fillStyle = c.beam; cg.fillRect(18, 18, w - 36, h - 36);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cg.fillStyle = i % 2 ? c.accent : '#f0c05a';
      cg.beginPath(); cg.ellipse(128 + Math.cos(a) * 42, 128 + Math.sin(a) * 42, 36, 16, a, 0, Math.PI * 2); cg.fill();
    }
    cg.fillStyle = '#f2e7c9'; cg.beginPath(); cg.arc(128, 128, 22, 0, Math.PI * 2); cg.fill();
  }, [9, 12]);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, L), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL, ZC); g.add(ceil);

  // 수미단과 불상, 탱화
  const altar = new THREE.Group();
  altar.position.set(0, 0, -12.8);
  const altarMat = new THREE.MeshStandardMaterial({ map: dancheong('#5a2a1e', c.accent), roughness: 0.6 });
  const sumi = new THREE.Mesh(new THREE.BoxGeometry(9, 1.3, 3.6), altarMat);
  sumi.position.y = 0.65; sumi.castShadow = sumi.receiveShadow = true; altar.add(sumi);
  const top = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.15, 3.9), mat('#3b1f16')); top.position.y = 1.35; altar.add(top);
  const buddhaSlot = new THREE.Group();
  buddhaSlot.position.set(0, 1.42, -0.2);
  const buddha = buildBuddha();
  buddha.scale.setScalar(1.15);
  buddhaSlot.add(buddha);
  altar.add(buddhaSlot);
  const halo = mandorla(); halo.position.set(0, 1.5, -1.3); halo.scale.setScalar(0.95); altar.add(halo);
  // 촛대, 꽃병, 향로
  const candle = (x) => {
    const cg = new THREE.Group();
    cg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.7, 12), gold()));
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 12), mat('#f6efe0')); wax.position.y = 0.55; cg.add(wax);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
    flame.scale.y = 1.8; flame.position.y = 0.86; cg.add(flame);
    cg.userData.flame = flame;
    cg.position.set(x, 1.78, 1.35);
    altar.add(cg);
    const light = new THREE.PointLight(c.lamp, 2.2, 8, 1.6);
    light.position.set(x, 2.9, 1.6); altar.add(light);
    return flame;
  };
  const flames = [candle(-2.6), candle(2.6)];
  for (const x of [-3.6, 3.6]) {
    const vase = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat('#6f9a8c', { roughness: 0.3 }));
    vase.scale.y = 1.3; vase.position.set(x, 1.8, 1.0); altar.add(vase);
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(['#f2f0ea', '#f3b6c4', '#f2d27a'][i % 3]));
      fl.position.set(x + Math.sin(i * 1.3) * 0.25, 2.35 + (i % 2) * 0.2, 1.0 + Math.cos(i * 1.3) * 0.15); altar.add(fl);
    }
  }
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.35, 16), gold());
  burner.position.set(0, 1.62, 1.5); altar.add(burner);
  g.add(altar);

  const painting = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshStandardMaterial({ map: taenghwa(), roughness: 0.9 }));
  painting.position.set(0, 5.6, -HD + 0.05); g.add(painting);

  // 부처님 비추는 조명
  const spot = new THREE.SpotLight('#fff1d6', 120, 30, 0.5, 0.6, 1.5);
  spot.position.set(0, 8.5, -4);
  spot.target.position.set(0, 3, -13);
  g.add(spot, spot.target);

  // 방석 100개 (10줄 × 가운데 통로 양쪽 5개씩). 한 번에 그리도록 InstancedMesh
  const cushions = [];
  const cols = [-9.9, -7.85, -5.8, -3.75, -1.7, 1.7, 3.75, 5.8, 7.85, 9.9];
  const cushionMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.12, 1.15), mat('#625e53'), cols.length * 10);
  const M = new THREE.Matrix4();
  for (let r = 0; r < 10; r++) for (const x of cols) {
    const z = -5.6 + r * 2.0;
    const id = cushions.length;
    M.makeTranslation(x, 0.06, z);
    cushionMesh.setMatrixAt(id, M);
    cushions.push({ id, pos: new THREE.Vector3(x, 0, z), rot: Math.PI, y: 0.12 });
  }
  cushionMesh.receiveShadow = true;
  cushionMesh.userData.seats = 'cushion';
  g.add(cushionMesh);

  // 복전함 (불전함)
  const box = new THREE.Group();
  box.position.set(0, 0, -8.4);
  const boxBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.9), new THREE.MeshStandardMaterial({ map: dancheong('#6b2c22', '#f0c05a'), roughness: 0.6 }));
  boxBody.position.y = 0.55; boxBody.castShadow = true; box.add(boxBody);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.0), mat('#3b1f16')); lid.position.y = 1.15; box.add(lid);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.1), mat('#0d0806')); slot.position.y = 1.21; box.add(slot);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 100, (cg, w, h) => {
      cg.fillStyle = '#f3e6c3'; cg.fillRect(0, 0, w, h);
      cg.fillStyle = '#5a1a14'; cg.font = `700 56px ${FONT_TITLE}`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
      cg.fillText('복전함', w / 2, h / 2 + 4);
    }),
  }));
  label.position.set(0, 0.62, 0.46); box.add(label);
  box.userData.donation = true;
  box.traverse((o) => { o.userData.donation = true; });
  g.add(box);

  // 연등: 천장 아래 줄지어 매달기
  const lanternRoot = new THREE.Group();
  g.add(lanternRoot);
  const lanternSlots = [];
  for (let r = 0; r < 7; r++) for (let k = 0; k < 10; k++) {
    lanternSlots.push(new THREE.Vector3(-9 + k * 2, 6.6 + ((k + r) % 2) * 0.25, -9 + r * 3.6));
  }
  const decoColors = ['#f08aa0', '#f2c45a', '#f6f2e8', '#9ad0a8', '#f2a05a'];
  const rr = rng(11);
  for (let i = 0; i < 26; i++) {
    const idx = Math.floor(rr() * lanternSlots.length);
    const l = buildLantern(decoColors[i % decoColors.length], 0.7);
    l.position.copy(lanternSlots[idx]);
    lanternRoot.add(l);
  }

  const hemi = new THREE.HemisphereLight('#fff4e2', '#3a2a20', 0.9);
  g.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 1.4);
  sun.position.set(8, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  sun.target.position.set(0, 0, ZC);
  g.add(sun, sun.target);

  return {
    group: g,
    floor,
    cushions,
    donationBox: box,
    lanternRoot,
    lanternSlots,
    flames,
    buddhaSlot,
    exitDoor,
    spawn: new THREE.Vector3(0, 0, 15),
    spawnRot: Math.PI,
    exitZ: HF - 1.4,
    camDist: 4.2,
    seats: cushions,
    bounds: { minX: -HW + 0.8, maxX: HW - 0.8, minZ: -HD + 0.8, maxZ: HF - 0.8 },
    blockers: [{ minX: -5, maxX: 5, minZ: -16, maxZ: -10.6 }, { minX: -0.95, maxX: 0.95, minZ: -8.95, maxZ: -7.85 }],
    fog: null,
    background: new THREE.Color('#1c1410'),
  };
}

// ───────── 외부 ─────────
const R0 = 22;

function heightFn(id) {
  if (id === 'forest') {
    return (x, z) => {
      const d = Math.hypot(x, z);
      let h = -24 * smooth(R0, R0 + 70, d) + noise(x, z) * 5 * smooth(R0, R0 + 20, d);
      h += 70 * smooth(160, 320, d) * (0.6 + 0.4 * noise(x * 0.5, z * 0.5));
      if (z < -10) h += Math.max(0, -z - 30) * 0.45;
      return h;
    };
  }
  if (id === 'river') {
    const arms = riverPaths();
    return (x, z) => {
      const d = Math.hypot(x, z);
      let h = -70 * smooth(R0 - 2, R0 + 60, d) + noise(x, z) * 5 * smooth(R0, R0 + 30, d);
      h += 120 * smooth(220, 400, d) * (0.55 + 0.45 * noise(x * 0.4, z * 0.4));
      if (z < 0) h += 30 * smooth(30, 120, -z);
      if (d > 60) {
        const rd = distToPaths(x, z, arms);
        h = Math.min(h, -79 + smooth(8, 26, rd) * 30 + smooth(26, 90, rd) * 400);
        if (rd < 30) h = Math.min(h, -79 + rd * 0.2);
        // 두 물줄기가 만나는 곳의 작은 섬
        const ci = Math.exp(-((x + 10) ** 2 + (z - 154) ** 2) / 128);
        h = Math.max(h, -79 + ci * 6);
      }
      return h;
    };
  }
  // sea
  const islands = [[60, 150, 26], [-90, 190, 34], [150, 260, 40], [-40, 300, 30], [10, 230, 18], [-170, 140, 28], [210, 140, 22], [90, 360, 48]];
  return (x, z) => {
    const d = Math.hypot(x, z);
    let h = -62 * smooth(R0 - 1, R0 + 22, d) + noise(x * 1.6, z * 1.6) * 5 * smooth(R0, R0 + 10, d);
    if (z < -26) h += 60 * smooth(-26, -110, z) + noise(x, z) * 8 * smooth(-26, -50, z);
    for (const [ix, iz, r] of islands) {
      const k = Math.exp(-((x - ix) ** 2 + (z - iz) ** 2) / (2 * r * r));
      h = Math.max(h, -60 + k * (r * 0.9) + noise(x, z) * 3 * k);
    }
    return h;
  };
}

function riverPaths() {
  // 두 강줄기가 화면 앞쪽에서 만나 하나로 흘러간다
  const left = [], right = [], main = [];
  for (let t = 0; t <= 1; t += 0.05) {
    left.push([-320 + t * 300 + Math.sin(t * 5) * 20, 90 + t * 70]);
    right.push([300 - t * 290 + Math.sin(t * 4 + 1) * 18, 220 - t * 60]);
    main.push([-10 + Math.sin(t * 3) * 40, 160 + t * 260]);
  }
  return [left, right, main];
}
function distToPaths(x, z, paths) {
  let best = Infinity;
  for (const p of paths) for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

function terrain(id) {
  const size = 900, seg = 180;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const h = heightFn(id);
  const p = geo.attributes.position;
  const colors = [];
  const grass = new THREE.Color(id === 'forest' ? '#7a8f4a' : id === 'river' ? '#6f8a52' : '#6c8a4f');
  const rock = new THREE.Color('#8b8378');
  const sand = new THREE.Color('#cdbb94');
  const autumn = new THREE.Color('#b4703a');
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = h(x, z);
    p.setY(i, y);
    const d = Math.hypot(x, z);
    tmp.copy(grass);
    if (id === 'forest') tmp.lerp(autumn, 0.35 + 0.3 * noise(x * 0.7, z * 0.7));
    if (d > R0 && d < R0 + 30 && id !== 'forest') tmp.lerp(rock, 0.6);
    if (id === 'sea' && y < -56) tmp.copy(sand);
    if (id === 'river' && y < -76) tmp.copy(sand);
    if (d < R0 - 1) tmp.set('#b3a88f');
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true;
  return { mesh: m, h };
}

function scatterTrees(h, count, seed, { minD = R0 + 3, maxD = 260, autumn = true, skip } = {}) {
  const r = rng(seed);
  const pine = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 6, 7), mat('#2f4f3a'), count);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6), mat('#5a3d2a'), count * 2);
  const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), count);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const palette = autumn ? ['#c0552f', '#e0a03a', '#a33b2a', '#d8b14a', '#7a8a3a', '#e07a3a'] : ['#4f7a45', '#5f8a4a', '#3f6a3f'];
  let np = 0, nl = 0, nt = 0;
  for (let i = 0; i < count * 2; i++) {
    const a = r() * Math.PI * 2, d = minD + Math.sqrt(r()) * (maxD - minD);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (skip && skip(x, z)) continue;
    const y = h(x, z);
    const sc = 0.7 + r() * 0.9;
    s.set(sc, sc, sc);
    v.set(x, y + 1.2 * sc, z); M.compose(v, q, s);
    if (nt < count * 2) trunk.setMatrixAt(nt++, M);
    if (r() < 0.45) {
      if (np >= count) continue;
      v.set(x, y + 4.5 * sc, z); M.compose(v, q, s); pine.setMatrixAt(np++, M);
    } else {
      if (nl >= count) continue;
      v.set(x, y + 3.6 * sc, z); M.compose(v, q, s); leaf.setMatrixAt(nl, M);
      leaf.setColorAt(nl++, new THREE.Color(palette[Math.floor(r() * palette.length)]));
    }
  }
  pine.count = np; leaf.count = nl; trunk.count = nt;
  for (const m of [pine, trunk, leaf]) { m.castShadow = true; m.instanceMatrix.needsUpdate = true; }
  if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
  const g = new THREE.Group(); g.add(pine, trunk, leaf);
  return g;
}

export function buildExterior(loc) {
  const g = new THREE.Group();
  g.add(skyDome(loc.sky[0], loc.sky[1]));
  const { mesh: ground, h } = terrain(loc.id);
  g.add(ground);

  // 마당: 돌판 원
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(R0 - 1, 48), new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; g.add(plaza);

  const hall = buildHallBuilding(loc);
  hall.position.set(0, 0, -9);
  g.add(hall);
  const door = hall.userData.door.clone().add(hall.position);

  const animated = [];
  const isSky = (x, z) => Math.hypot(x, z) < R0 + 2;
  if (loc.id === 'forest') {
    g.add(scatterTrees(h, 700, 5, { maxD: 300 }));
    // 수목원 온실
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#cfe7ee', transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 }));
    dome.position.set(55, h(55, 70), 70); g.add(dome);
    const ribs = new THREE.Mesh(new THREE.SphereGeometry(9.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2f2ee', wireframe: true }));
    ribs.position.copy(dome.position); g.add(ribs);
    const p = pagoda(3); p.position.set(-12, 0, 6); g.add(p);
  }
  if (loc.id === 'river') {
    g.add(scatterTrees(h, 520, 9, { minD: R0 + 6, maxD: 420, autumn: true, skip: (x, z) => h(x, z) < -74 }));
    const paths = riverPaths();
    const water = new THREE.MeshStandardMaterial({ color: '#7fa9c2', roughness: 0.15, metalness: 0.25 });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), water);
    river.rotation.x = -Math.PI / 2; river.position.y = -76.5; g.add(river);
    // 두물머리 느티나무 한 그루
    const [mx, mz] = paths[2][0];
    const tree = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 10, 8), mat('#5a3d2a')); tr.position.y = 5; tree.add(tr);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), mat('#c7902f')); crown.position.y = 14; crown.scale.y = 0.7; tree.add(crown);
    tree.position.set(mx, h(mx, mz) + 0.5, mz - 6); g.add(tree);
    // 물안개
    for (let i = 0; i < 6; i++) {
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(400, 60), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
      mist.rotation.x = -Math.PI / 2; mist.position.set((i - 3) * 60, -60 + i * 3, 140 + i * 30);
      g.add(mist); animated.push((t) => { mist.position.x = (i - 3) * 60 + Math.sin(t * 0.05 + i) * 30; });
    }
    const p = pagoda(3); p.position.set(12, 0, 4); g.add(p);
    addRailing(g, R0 - 1.5, -0.25 * Math.PI, 1.25 * Math.PI);
  }
  if (loc.id === 'sea') {
    g.add(scatterTrees(h, 380, 21, { minD: R0 + 4, maxD: 400, autumn: false, skip: (x, z) => h(x, z) < -52 }));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000, 1, 1), new THREE.MeshStandardMaterial({ color: '#3f86ad', roughness: 0.18, metalness: 0.3 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -55; g.add(sea);
    // 반짝이는 물비늘
    const glints = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 0.25), new THREE.MeshBasicMaterial({ color: '#fff8e0', transparent: true, opacity: 0.7, depthWrite: false }), 400);
    const r = rng(77), M = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (let i = 0; i < 400; i++) {
      M.compose(new THREE.Vector3((r() - 0.5) * 500, -54.9, 60 + r() * 400), q, new THREE.Vector3(1 + r() * 2, 1, 1));
      glints.setMatrixAt(i, M);
    }
    g.add(glints);
    animated.push((t) => { glints.material.opacity = 0.4 + Math.sin(t * 1.7) * 0.25; });
    // 절벽 끝 석탑과 바위
    const p = pagoda(3); p.position.set(9, 0, 10); g.add(p);
    const rockMat = mat('#8f8a80');
    const rr = rng(5);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, d = R0 + rr() * 6;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rr() * 3, 0), rockMat);
      rock.position.set(Math.cos(a) * d, h(Math.cos(a) * d, Math.sin(a) * d) - 1, Math.sin(a) * d);
      rock.rotation.set(rr() * 3, rr() * 3, rr() * 3); rock.castShadow = true; g.add(rock);
    }
    addRailing(g, R0 - 1.5, -0.15 * Math.PI, 1.15 * Math.PI);
  }

  const hemi = new THREE.HemisphereLight(loc.sky[0], '#6b5a44', 1.1);
  g.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
  sun.position.set(30, 50, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0006;
  g.add(sun, sun.target);

  return {
    group: g,
    floor: plaza,
    door,
    spawn: new THREE.Vector3(0, 0, 12),
    spawnRot: Math.PI,
    camDist: 8,
    // 산보 길: 법당 뒤를 돌아 마당 가장자리를 한 바퀴
    walkPath: [[-11, -16.5], [11, -16.5], [14, -4], [15, 8], [7, 16], [-7, 16], [-15, 8], [-14, -4]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    radius: R0 - 2.2,
    blockers: [{ minX: -hall.userData.footprint.w, maxX: hall.userData.footprint.w, minZ: -9 - hall.userData.footprint.d, maxZ: -9 + hall.userData.footprint.d }],
    fog: new THREE.Fog(loc.fog, 120, 700),
    background: new THREE.Color(loc.sky[1]),
    update: (t) => animated.forEach((f) => f(t)),
  };
}

// ───────── 방 공통 ─────────
function roomShell(g, loc, { HW, HD, CEIL, floorMap, windows = [], doorW = 3 }) {
  const c = loc.interior;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HD * 2), new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const plaster = new THREE.MeshStandardMaterial({ color: c.wall, roughness: 0.95 });
  const wood = mat('#5a3826');
  const wall = (w, h, x, y, z, ry, material = plaster) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m;
  };
  wall(HW * 2, CEIL, 0, CEIL / 2, -HD, 0);
  wall(HW * 2, CEIL, 0, CEIL / 2, HD, Math.PI);
  wall(HD * 2, CEIL, -HW, CEIL / 2, 0, Math.PI / 2);
  wall(HD * 2, CEIL, HW, CEIL / 2, 0, -Math.PI / 2);
  for (const [w, x, z, ry] of [[HW * 2, 0, -HD + 0.02, 0], [HW * 2, 0, HD - 0.02, Math.PI], [HD * 2, -HW + 0.02, 0, Math.PI / 2], [HD * 2, HW - 0.02, 0, -Math.PI / 2]]) wall(w, 0.6, x, 0.3, z, ry, wood);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HD * 2), mat('#6b4a33'));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = CEIL; g.add(ceil);
  for (let x = -HW + 1; x < HW; x += 1.6) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, HD * 2), mat('#4a2f22')); r.position.set(x, CEIL - 0.1, 0); g.add(r);
  }
  const viewMat = new THREE.MeshBasicMaterial({ map: windowView(loc) });
  const frameMat = new THREE.MeshStandardMaterial({ map: lattice(c.pillar, 'rgba(0,0,0,0)', false), transparent: true, alphaTest: 0.4 });
  for (const [x, z, ry, w, h] of windows) { wall(w, h, x, CEIL * 0.55, z, ry, viewMat); wall(w, h, x + Math.sin(ry) * 0.03, CEIL * 0.55, z + Math.cos(ry) * 0.03, ry, frameMat); }
  const door = wall(doorW, Math.min(CEIL - 0.4, 2.8), 0, Math.min(CEIL - 0.4, 2.8) / 2, HD - 0.04, Math.PI, new THREE.MeshStandardMaterial({ map: lattice(c.pillar), emissive: '#ffe9c0', emissiveIntensity: 0.12 }));
  return { floor, door };
}

function roomLights(g, warm, { size = 12, at = [6, 10, 8] } = {}) {
  g.add(new THREE.HemisphereLight('#fff4e2', '#3a2a20', 1.0));
  const sun = new THREE.DirectionalLight('#fff0d8', 1.3);
  sun.position.set(...at);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0008;
  g.add(sun);
  const p = new THREE.PointLight(warm, 3, 14, 1.5); p.position.set(0, 3, 0); g.add(p);
}

function scroll(text, sub) {
  return canvasTex(256, 640, (cg, w, h) => {
    cg.fillStyle = '#efe4c8'; cg.fillRect(0, 0, w, h);
    cg.fillStyle = '#6b4a33'; cg.fillRect(0, 0, w, 24); cg.fillRect(0, h - 24, w, 24);
    // 세로 글씨. 글자가 많으면 크기를 줄여 족자 안에 맞추고, 띄어쓰기는 반 칸만 띈다
    const chars = [...String(text).trim()];
    const units = chars.reduce((n, ch) => n + (ch === ' ' ? 0.45 : 1), 0) || 1;
    const step = Math.min(78, (h - 210) / units);
    cg.fillStyle = '#2b2220'; cg.font = `700 ${Math.round(step * 0.82)}px ${FONT_TITLE}`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    let y = 70 + step / 2;
    for (const ch of chars) { if (ch === ' ') { y += step * 0.45; continue; } cg.fillText(ch, w / 2 - (sub ? 10 : 0), y); y += step; }
    if (sub) {
      const sc = [...String(sub).replace(/\s+/g, '')];
      const sstep = Math.min(28, (h - 200) / sc.length);
      cg.font = `400 ${Math.round(sstep * 0.8)}px ${FONT_TITLE}`; cg.fillStyle = '#7a5a40';
      sc.forEach((ch, i) => cg.fillText(ch, w - 36, 90 + i * sstep));
    }
    cg.fillStyle = '#b8463f'; cg.fillRect(w / 2 - 18, h - 90, 36, 36);
  });
}

// ───────── 공양간 (발우공양) ─────────
// 두 줄씩 마주 보고 앉는 자리 4줄 × 15 = 60자리. 자리마다 앞에 발우 네 그릇
export function buildMealHall(loc) {
  const g = new THREE.Group();
  const HW = 12, HD = 9, CEIL = 5.5;
  const { floor, door } = roomShell(g, loc, {
    HW, HD, CEIL, floorMap: woodFloor('#6a4a34'),
    windows: [[-HW + 0.03, -4, Math.PI / 2, 3.4, 2.4], [-HW + 0.03, 4, Math.PI / 2, 3.4, 2.4], [HW - 0.03, -4, -Math.PI / 2, 3.4, 2.4], [HW - 0.03, 4, -Math.PI / 2, 3.4, 2.4]],
  });
  const seats = [];
  const rows = [[-6.4, 0], [-2.4, Math.PI], [2.0, 0], [6.0, Math.PI]];
  const xs = []; for (let x = -10.5; x <= 10.51; x += 1.5) xs.push(x);
  const n = rows.length * xs.length;
  const cushion = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), mat('#5d5a50'), n);
  const bowl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.1, 0.11, 16), mat('#4a2418', { roughness: 0.3 }), n * 4);
  const rice = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14), mat('#f4efe2'), n * 4);
  const M = new THREE.Matrix4();
  let bi = 0;
  for (const [z, rot] of rows) for (const x of xs) {
    const id = seats.length;
    M.makeTranslation(x, 0.05, z); cushion.setMatrixAt(id, M);
    seats.push({ id, pos: new THREE.Vector3(x, 0, z), rot, y: 0.1 });
    const dir = rot === 0 ? 1 : -1;
    for (const [dx, dz] of [[-0.18, 0.62], [0.18, 0.62], [-0.18, 0.95], [0.18, 0.95]]) {
      M.makeTranslation(x + dx, 0.07, z + dz * dir); bowl.setMatrixAt(bi, M);
      M.makeTranslation(x + dx, 0.125, z + dz * dir); rice.setMatrixAt(bi, M);
      bi++;
    }
  }
  cushion.userData.seats = 'meal';
  cushion.receiveShadow = true;
  bowl.castShadow = true;
  g.add(cushion, bowl, rice);
  // 마주 보는 두 줄 사이에 흰 천
  for (const z of [-4.4, 4.0]) {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(23, 0.02, 1.0), mat('#f3efe6'));
    cloth.position.set(0, 0.012, z); cloth.receiveShadow = true; g.add(cloth);
  }
  // 앞쪽 벽: 작은 불단과 오관게 족자
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 0.8), new THREE.MeshStandardMaterial({ map: dancheong('#5a2a1e', loc.interior.accent) }));
  shelf.position.set(-HW + 0.6, 0.55, 0); shelf.rotation.y = Math.PI / 2; g.add(shelf);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.5), new THREE.MeshStandardMaterial({ map: scroll('오관게', '이음식이어디서왔는가') }));
  sc.position.set(0, 3.0, -HD + 0.06); g.add(sc);
  // 밥솥과 국통
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.7, 20), mat('#2f2b28', { metalness: 0.4, roughness: 0.5 }));
  pot.position.set(HW - 1.4, 0.35, -HD + 1.4); pot.castShadow = true; g.add(pot);
  const pot2 = pot.clone(); pot2.position.x -= 1.6; pot2.scale.setScalar(0.75); g.add(pot2);
  roomLights(g, loc.interior.lamp, { size: 14 });
  return {
    group: g, floor, seats, exitDoor: door,
    spawn: new THREE.Vector3(0, 0, HD - 1.6), spawnRot: Math.PI,
    exitZ: HD - 0.9, camDist: 5,
    bounds: { minX: -HW + 0.6, maxX: HW - 0.6, minZ: -HD + 0.6, maxZ: HD - 0.6 },
    blockers: [], fog: null, background: new THREE.Color('#1c1410'),
  };
}

// ───────── 내 방 (혼자 책 읽는 요사채 방) ─────────
export function buildRoom(loc) {
  const g = new THREE.Group();
  const HW = 3.2, HD = 3.2, CEIL = 3.2;
  const jangpan = canvasTex(256, 256, (cg, w, h) => {
    cg.fillStyle = '#d9b46a'; cg.fillRect(0, 0, w, h);
    cg.strokeStyle = 'rgba(120, 80, 30, 0.35)'; cg.lineWidth = 3;
    for (let i = 0; i <= w; i += 64) { cg.beginPath(); cg.moveTo(i, 0); cg.lineTo(i, h); cg.stroke(); cg.beginPath(); cg.moveTo(0, i); cg.lineTo(w, i); cg.stroke(); }
  }, [4, 4]);
  const { floor, door } = roomShell(g, loc, { HW, HD, CEIL, floorMap: jangpan, windows: [[-HW + 0.03, -0.4, Math.PI / 2, 1.8, 1.4]], doorW: 1.8 });
  // 경상(낮은 책상), 책, 등, 찻잔
  const desk = new THREE.Group();
  desk.position.set(0, 0, -1.55);
  const woodM = mat('#7a4a2c', { roughness: 0.5 });
  const topM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.7), woodM); topM.position.y = 0.42; desk.add(topM);
  for (const [x, z] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), woodM); l.position.set(x, 0.2, z); desk.add(l); }
  const colors = ['#2f5d50', '#8a3a2c', '#c9a86a', '#3b4a6b'];
  colors.forEach((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.24), mat(c)); b.position.set(-0.5, 0.49 + i * 0.06, -0.1); b.rotation.y = i * 0.15; desk.add(b); });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 12), mat('#e9e2d2')); cup.position.set(0.52, 0.5, 0.05); desk.add(cup);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), new THREE.MeshStandardMaterial({ color: '#f3e6c3', emissive: '#ffcf7a', emissiveIntensity: 0.9 }));
  lamp.position.set(0.55, 0.6, -0.2); desk.add(lamp);
  desk.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(desk);
  const lampLight = new THREE.PointLight('#ffcf8a', 2.5, 6, 1.5); lampLight.position.set(0.55, 0.9, -1.75); g.add(lampLight);
  // 책장, 개어 둔 이불, 족자
  const shelf = new THREE.Group();
  shelf.position.set(HW - 0.3, 0, -0.6);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 1.6), mat('#6b4128')); frame.position.y = 0.9; shelf.add(frame);
  const rr = rng(4);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32 + rr() * 0.1, 0.16), mat(['#2f5d50', '#8a3a2c', '#c9a86a', '#3b4a6b', '#d9d2c0'][Math.floor(rr() * 5)]));
    b.position.set(-0.12, 0.3 + r * 0.55, -0.6 + i * 0.19); shelf.add(b);
  }
  g.add(shelf);
  const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), mat('#c97a7a')); quilt.position.set(-HW + 0.8, 0.2, HD - 0.8); quilt.castShadow = true; g.add(quilt);
  const quilt2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.8), mat('#f2ead8')); quilt2.position.set(-HW + 0.8, 0.52, HD - 0.8); g.add(quilt2);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.5), new THREE.MeshStandardMaterial({ map: scroll('일체유심조', '모든것은마음이짓는다') }));
  sc.position.set(0, 2.0, -HD + 0.05); g.add(sc);
  sc.userData.scroll = true;
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), mat('#5d5a50')); cushion.position.set(0, 0.05, -0.65); cushion.receiveShadow = true; g.add(cushion);
  cushion.userData.seats = 'room';
  roomLights(g, '#ffd9a0', { size: 5, at: [-4, 6, 2] });
  const seat = { id: 0, pos: new THREE.Vector3(0, 0, -0.65), rot: Math.PI, y: 0.1 };
  return {
    group: g, floor, seats: [seat], exitDoor: door,
    // 족자 문구 바꿔 걸기
    setScroll(text, sub) {
      sc.material.map.dispose();
      sc.material.map = scroll(text, sub);
      sc.material.needsUpdate = true;
    },
    spawn: seat.pos.clone(), spawnRot: Math.PI,
    exitZ: HD - 0.5, camDist: 2.8, minDist: 1.4, maxDist: 4.6,
    bounds: { minX: -HW + 0.4, maxX: HW - 0.4, minZ: -HD + 0.4, maxZ: HD - 0.4 },
    blockers: [{ minX: -0.8, maxX: 0.8, minZ: -1.95, maxZ: -1.15 }], fog: null, background: new THREE.Color('#1c1410'),
  };
}

function addRailing(g, r, a0, a1) {
  const wood = mat('#6b4a33');
  const n = 46;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), wood);
    post.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r); post.castShadow = true; g.add(post);
    if (i < n) {
      const b = a0 + (a1 - a0) * ((i + 1) / n);
      const x1 = Math.cos(a) * r, z1 = Math.sin(a) * r, x2 = Math.cos(b) * r, z2 = Math.sin(b) * r;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.1), wood);
      rail.position.set((x1 + x2) / 2, 1.0, (z1 + z2) / 2);
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      g.add(rail);
    }
  }
}
