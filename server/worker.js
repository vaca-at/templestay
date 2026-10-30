// 큰법당 템플스테이 방 중계 서버.
// 방(예: forest-3) 하나가 Durable Object 하나. 최대 100명이 웹소켓으로 붙고,
// 서로의 위치·동작·소원을 그대로 나눠 준다. 소원(연등)은 방 저장소에 60개까지 남는다.
import { DurableObject } from 'cloudflare:workers';

const CAP = 100;
// 'hall' 이 큰법당 서버 1~12. 예전 위치별 방 이름도 받아 둔다
const ROOM_RE = /^(hall|forest|river|sea)-([1-9]|1[0-9]|20)$/;
const ORIGINS = ['https://templestay.site', 'https://www.templestay.site', 'https://vaca-at.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];

function cors(req) {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin' };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const origin = req.headers.get('Origin');
      if (origin && !ORIGINS.includes(origin)) return new Response('forbidden', { status: 403 });
      const room = url.searchParams.get('room') || '';
      if (!ROOM_RE.test(room)) return new Response('bad room', { status: 400 });
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
    }
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors(req), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Credentials': 'false', 'Access-Control-Max-Age': '86400' } });
    }
    // 방문: 기기마다 하루 한 번 숫자만 센다 (누가 왔는지는 남기지 않음)
    if (url.pathname === '/visit' && req.method === 'POST') {
      await env.STATS.get(env.STATS.idFromName('stats')).fetch('https://stats/visit', { method: 'POST' });
      return json(req, { ok: true });
    }
    // 관리자 로그인: 비밀번호가 맞으면 30일짜리 입장권을 준다 (기기에는 비밀번호 대신 입장권만 남는다)
    if (url.pathname === '/admin/login' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || !(await same(String(body.password || '').trim(), env.ADMIN_PASSWORD.trim()))) return json(req, { error: 'unauthorized' }, 401);
      const exp = Date.now() + 30 * 24 * 3600 * 1000;
      return json(req, { token: `${exp}.${await sign(String(exp), env.ADMIN_PASSWORD.trim())}`, exp });
    }
    // 관리자: 입장권(또는 비밀번호)이 맞을 때만 방문 수와 접속 인원을 보여 준다
    if (url.pathname === '/admin/stats') {
      const auth = (req.headers.get('Authorization') || '').replace(/^Bearer /, '').trim();
      if (!env.ADMIN_PASSWORD || !(await adminOk(auth, env.ADMIN_PASSWORD.trim()))) return json(req, { error: 'unauthorized' }, 401);
      const stats = await env.STATS.get(env.STATS.idFromName('stats')).fetch('https://stats/read').then((r) => r.json());
      const rooms = {};
      await Promise.all(['hall'].flatMap((loc) => Array.from({ length: 12 }, (_, i) =>
        env.ROOMS.get(env.ROOMS.idFromName(`${loc}-${i + 1}`)).fetch('https://room/count').then((r) => r.json()).then((j) => { if (j.n) rooms[`${loc}-${i + 1}`] = j.n; }).catch(() => {}))));
      return json(req, { ...stats, rooms, online: Object.values(rooms).reduce((a, b) => a + b, 0) });
    }
    // 신고 보내기: 누구나. 글 1000자, 사진 1장(약 1.3MB까지)
    if (url.pathname === '/report' && req.method === 'POST') {
      const origin = req.headers.get('Origin');
      if (origin && !ORIGINS.includes(origin)) return json(req, { error: 'forbidden' }, 403);
      const body = await req.json().catch(() => null);
      if (!body) return json(req, { error: 'bad' }, 400);
      const text = clean(body.text, 1000).trim();
      const img = typeof body.img === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(body.img) && body.img.length < 1_400_000 ? body.img : null;
      if (!text && !img) return json(req, { error: 'empty' }, 400);
      const c = body.ctx || {};
      const ctx = { server: clean(c.server, 8), scene: clean(c.scene, 12), design: clean(c.design, 20), reporter: clean(c.reporter, 12), people: Array.isArray(c.people) ? c.people.slice(0, 30).map((n) => clean(n, 12)) : [], ua: clean(req.headers.get('User-Agent'), 160) };
      const ip = req.headers.get('CF-Connecting-IP') || '';
      const who = (await sign(ip, env.ADMIN_PASSWORD || 'salt')).slice(0, 16);
      const r = await env.STATS.get(env.STATS.idFromName('stats')).fetch('https://stats/report/add', { method: 'POST', body: JSON.stringify({ text, img, ctx, who }) });
      if (r.status === 429) return json(req, { error: 'too many' }, 429);
      return json(req, { ok: true });
    }
    // 관리자: 신고 목록 보기·지우기
    if (url.pathname === '/admin/reports' || url.pathname === '/admin/report-delete') {
      const auth = (req.headers.get('Authorization') || '').replace(/^Bearer /, '').trim();
      if (!env.ADMIN_PASSWORD || !(await adminOk(auth, env.ADMIN_PASSWORD.trim()))) return json(req, { error: 'unauthorized' }, 401);
      const stub = env.STATS.get(env.STATS.idFromName('stats'));
      if (url.pathname === '/admin/reports') return json(req, await stub.fetch('https://stats/report/list').then((r) => r.json()));
      const { id } = await req.json().catch(() => ({}));
      await stub.fetch('https://stats/report/delete', { method: 'POST', body: JSON.stringify({ id: String(id || '') }) });
      return json(req, { ok: true });
    }
    if (url.pathname === '/counts') {
      const loc = url.searchParams.get('loc') || '';
      const n = Math.min(20, Math.max(1, +url.searchParams.get('n') || 12));
      if (!/^(hall|forest|river|sea)$/.test(loc)) return json(req, { error: 'bad loc' }, 400);
      const counts = await Promise.all(Array.from({ length: n }, (_, i) =>
        env.ROOMS.get(env.ROOMS.idFromName(`${loc}-${i + 1}`)).fetch('https://room/count').then((r) => r.json()).then((j) => j.n).catch(() => 0)));
      return json(req, { counts });
    }
    return json(req, { ok: true, name: 'templestay-rooms' });
  },
};

const clean = (s, n) => String(s ?? '').slice(0, n);

// 비밀번호 비교: 해시끼리 비교해서 글자 수나 앞부분으로 알아낼 수 없게
async function same(a, b) {
  const h = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// 입장권 서명: 비밀번호를 열쇠로 한 HMAC. 비밀번호를 바꾸면 예전 입장권은 모두 무효가 된다
async function sign(msg, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function adminOk(auth, secret) {
  const m = /^(\d{13})\.([0-9a-f]{64})$/.exec(auth);
  if (m) return +m[1] > Date.now() && (await same(m[2], await sign(m[1], secret)));
  return same(auth, secret); // 예전처럼 비밀번호를 바로 보내도 된다
}

// 한국 시간 기준 날짜
const kstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// 방문 수 저장소 (하나뿐)
export class Stats extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url);
    // 신고: 한 건씩 'r:<시각>' 열쇠로 저장, 최근 200건만
    if (url.pathname === '/report/add') {
      const r = await req.json();
      // 같은 사람(접속 주소를 알아볼 수 없게 바꾼 값)은 한 시간에 5건까지
      const rl = (await this.ctx.storage.get(`rl:${r.who}`)) || [];
      const recent = rl.filter((t) => Date.now() - t < 3600e3);
      if (recent.length >= 5) return Response.json({ error: 'too many' }, { status: 429 });
      await this.ctx.storage.put(`rl:${r.who}`, [...recent, Date.now()]);
      const id = `r:${String(Date.now()).padStart(15, '0')}`;
      await this.ctx.storage.put(id, { ...r, id, at: Date.now() });
      const all = await this.ctx.storage.list({ prefix: 'r:', reverse: true });
      const old = [...all.keys()].slice(200);
      if (old.length) await this.ctx.storage.delete(old);
      return Response.json({ ok: true });
    }
    if (url.pathname === '/report/list') {
      const all = await this.ctx.storage.list({ prefix: 'r:', reverse: true, limit: 100 });
      return Response.json({ reports: [...all.values()].map(({ who, ...x }) => x) });
    }
    if (url.pathname === '/report/delete') {
      const { id } = await req.json();
      if (/^r:\d{15}$/.test(id)) await this.ctx.storage.delete(id);
      return Response.json({ ok: true });
    }
    const s = (await this.ctx.storage.get('s')) || { total: 0, days: {} };
    if (url.pathname === '/visit') {
      const d = kstDay();
      s.total++;
      s.days[d] = (s.days[d] || 0) + 1;
      // 최근 90일만 남긴다
      const keys = Object.keys(s.days).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - 90))) delete s.days[k];
      await this.ctx.storage.put('s', s);
      return Response.json({ ok: true });
    }
    return Response.json({ total: s.total, today: s.days[kstDay()] || 0, days: s.days });
  }
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 'ping' 에는 깨어나지 않고 바로 'pong' 으로 답한다 (잠든 방 비용 절약)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // 캐릭터가 있는(상태를 보낸) 사람만 센다
  members() {
    return this.ctx.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() })).filter((m) => m.a?.st);
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/count') return Response.json({ n: this.members().length });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    if (this.members().length >= CAP) {
      server.send(JSON.stringify({ t: 'full' }));
      server.close(4001, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = crypto.randomUUID().slice(0, 8);
    server.serializeAttachment({ id, st: null, n: 0, w: Date.now() });
    const peers = this.members().map((m) => ({ id: m.a.id, st: m.a.st }));
    const wishes = (await this.ctx.storage.get('wishes')) || [];
    server.send(JSON.stringify({ t: 'hello', id, peers, wishes }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > 3000) return;
    const a = ws.deserializeAttachment();
    if (!a) return;
    // 1초에 15개 넘게 보내면 버린다
    const now = Date.now();
    if (now - a.w > 1000) { a.w = now; a.n = 0; }
    if (++a.n > 15) { ws.serializeAttachment(a); return; }
    let m; try { m = JSON.parse(msg); } catch { return; }
    if (m.t === 'st' && m.d && typeof m.d === 'object') {
      a.st = m.d;
      ws.serializeAttachment(a);
      this.broadcast({ t: 'st', id: a.id, d: m.d }, ws);
    } else if (m.t === 'act' && m.d) {
      ws.serializeAttachment(a);
      this.broadcast({ t: 'act', id: a.id, d: { a: clean(m.d.a, 16), on: m.d.on !== false } }, ws);
    } else if (m.t === 'wish' && m.d) {
      ws.serializeAttachment(a);
      const w = { id: clean(m.d.id, 40), n: clean(m.d.n, 12), t: clean(m.d.t, 80), c: clean(m.d.c, 9), v: Math.max(0, Math.min(100000, m.d.v | 0)) };
      if (!w.id || !w.t) return;
      const list = (await this.ctx.storage.get('wishes')) || [];
      if (list.some((x) => x.id === w.id)) return;
      list.push(w);
      await this.ctx.storage.put('wishes', list.slice(-60));
      this.broadcast({ t: 'wish', id: a.id, d: w }, ws);
    }
  }

  webSocketClose(ws, code) {
    const a = ws.deserializeAttachment();
    if (a?.st) this.broadcast({ t: 'leave', id: a.id }, ws);
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch {}
  }

  webSocketError(ws) { this.webSocketClose(ws, 1011); }

  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) { try { ws.send(s); } catch {} }
  }
}
