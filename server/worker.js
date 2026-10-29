// 큰법당 템플스테이 방 중계 서버.
// 방(예: forest-3) 하나가 Durable Object 하나. 최대 100명이 웹소켓으로 붙고,
// 서로의 위치·동작·소원을 그대로 나눠 준다. 소원(연등)은 방 저장소에 60개까지 남는다.
import { DurableObject } from 'cloudflare:workers';

const CAP = 100;
const ROOM_RE = /^(forest|river|sea)-([1-9]|1[0-9]|20)$/;
const ORIGINS = ['https://templestay.site', 'https://www.templestay.site', 'https://vaca-at.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];

function cors(req) {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin' };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

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
    if (url.pathname === '/counts') {
      const loc = url.searchParams.get('loc') || '';
      const n = Math.min(20, Math.max(1, +url.searchParams.get('n') || 12));
      if (!/^(forest|river|sea)$/.test(loc)) return json(req, { error: 'bad loc' }, 400);
      const counts = await Promise.all(Array.from({ length: n }, (_, i) =>
        env.ROOMS.get(env.ROOMS.idFromName(`${loc}-${i + 1}`)).fetch('https://room/count').then((r) => r.json()).then((j) => j.n).catch(() => 0)));
      return json(req, { counts });
    }
    return json(req, { ok: true, name: 'templestay-rooms' });
  },
};

const clean = (s, n) => String(s ?? '').slice(0, n);

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
