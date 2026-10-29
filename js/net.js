// 실시간 접속: 별도 서버 없이 브라우저끼리 직접 연결(WebRTC)하는 Trystero를 쓴다.
// 법당 위치마다 로비 방 하나(서버별 인원 집계)와 서버 방 하나(캐릭터 위치·동작 공유)에 들어간다.
import { APP_ID } from './data.js';

let trystero = null;
async function lib() {
  if (!trystero) trystero = await import('https://esm.sh/trystero@0.21.8/nostr');
  return trystero;
}

export class Net {
  constructor(handlers) {
    this.h = handlers;
    this.lobby = null;
    this.room = null;
    this.lobbyPeers = new Map(); // peerId -> { s: 서버번호, c: 캐릭터 있음 }
    this.online = false;
    this.me = { s: 0, c: false };
    this.lastState = null;
  }

  get selfId() { return trystero?.selfId; }

  async joinLobby(locId, hasChar) {
    await this.leaveAll();
    this.me = { s: 0, c: hasChar };
    try {
      const T = await lib();
      this.lobby = T.joinRoom({ appId: APP_ID }, `lobby-${locId}`);
      const [sendSrv, getSrv] = this.lobby.makeAction('srv');
      this.sendSrv = sendSrv;
      getSrv((d, peer) => { this.lobbyPeers.set(peer, d); this.h.onCounts?.(this.counts()); });
      this.lobby.onPeerJoin((peer) => sendSrv(this.me, peer));
      this.lobby.onPeerLeave((peer) => { this.lobbyPeers.delete(peer); this.h.onCounts?.(this.counts()); });
      this.online = true;
    } catch (e) {
      console.warn('실시간 연결을 시작하지 못했어요', e);
      this.online = false;
    }
    this.locId = locId;
  }

  // 서버 번호별 캐릭터 인원 (나 포함)
  counts() {
    const c = {};
    for (const v of this.lobbyPeers.values()) if (v.c && v.s) c[v.s] = (c[v.s] || 0) + 1;
    if (this.me.c && this.me.s) c[this.me.s] = (c[this.me.s] || 0) + 1;
    return c;
  }

  async joinServer(n) {
    if (this.room) { await this.room.leave(); this.room = null; this.h.onReset?.(); }
    this.me.s = n;
    this.sendSrv?.(this.me);
    this.h.onCounts?.(this.counts());
    if (!this.online) return;
    const T = await lib();
    const room = T.joinRoom({ appId: APP_ID }, `${this.locId}-${n}`);
    this.room = room;
    const [sendSt, getSt] = room.makeAction('st');
    const [sendAct, getAct] = room.makeAction('act');
    const [sendWish, getWish] = room.makeAction('wish');
    const [sendLan, getLan] = room.makeAction('lan');
    this._st = sendSt; this._act = sendAct; this._wish = sendWish;
    getSt((d, peer) => this.h.onState?.(peer, d));
    getAct((d, peer) => this.h.onAct?.(peer, d));
    getWish((d, peer) => this.h.onWish?.(peer, d, false));
    getLan((list, peer) => list.forEach((w) => this.h.onWish?.(peer, w, true)));
    room.onPeerJoin((peer) => {
      if (this.lastState) sendSt(this.lastState, peer);
      const wishes = this.h.getWishes?.() || [];
      if (wishes.length) sendLan(wishes.slice(-40), peer);
    });
    room.onPeerLeave((peer) => this.h.onLeave?.(peer));
  }

  sendState(s) { this.lastState = s; this._st?.(s); }
  sendAct(a) { this._act?.(a); }
  sendWish(w) { this._wish?.(w); }

  async leaveAll() {
    try { await this.room?.leave(); } catch {}
    try { await this.lobby?.leave(); } catch {}
    this.room = this.lobby = null;
    this._st = this._act = this._wish = this.sendSrv = null;
    this.lobbyPeers.clear();
    this.h.onReset?.();
  }
}
