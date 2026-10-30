// 관리자: 화면 아래 투명한 버튼 → 비밀번호 → 방문 수·지금 접속·서버별 인원.
// 로그인하면 서버가 30일짜리 입장권을 주고, 이 기기에는 비밀번호 대신 입장권만 남는다 ("나가기"로 지움).
// 관리자로 들어가 있는 동안만 body 에 .admin 을 붙여서, 숨겨 둔 인원·누적 숫자가 보이게 한다.
// 방문은 기기마다 하루 한 번 숫자만 센다 (누가 왔는지는 남기지 않음).
import { RELAY_URL, LOCATIONS } from './data.js';

const $ = (s) => document.querySelector(s);
const KEY = 'maeum:adminToken';
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
// 입장권: "만료시각.서명". 만료가 지났으면 없는 것으로 본다
const getPw = () => {
  try {
    const t = localStorage.getItem(KEY) || '';
    if (t && +t.split('.')[0] < Date.now()) { localStorage.removeItem(KEY); return ''; }
    return t;
  } catch { return ''; }
};
const setPw = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };
try { sessionStorage.removeItem('maeum:admin'); } catch {} // 예전 방식(비밀번호를 탭에 저장)은 지운다

async function login(pw) {
  const r = await fetch(`${RELAY_URL}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
  if (r.status === 401) throw new Error('wrong');
  if (!r.ok) throw new Error('server');
  return (await r.json()).token;
}

// 방문 세기
if (RELAY_URL && !new URLSearchParams(location.search).has('demo')) {
  let seen = null;
  try { seen = localStorage.getItem('maeum:visited'); } catch {}
  if (seen !== today()) {
    fetch(`${RELAY_URL}/visit`, { method: 'POST' }).then(() => { try { localStorage.setItem('maeum:visited', today()); } catch {} }).catch(() => {});
  }
}

async function fetchStats(pw) {
  const r = await fetch(`${RELAY_URL}/admin/stats`, { headers: { Authorization: `Bearer ${pw}` } });
  if (r.status === 401) throw new Error('wrong');
  if (!r.ok) throw new Error('server');
  return r.json();
}

function setAdmin(on) {
  document.body.classList.toggle('admin', on);
}

function render(s) {
  const locName = (id) => (id === 'hall' ? '큰법당' : LOCATIONS.find((l) => l.id === id)?.name || id);
  const days = Object.entries(s.days || {}).sort().slice(-14);
  const max = Math.max(1, ...days.map(([, n]) => n));
  $('#admin-stats').innerHTML = `
    <div class="stats">
      <div class="stat"><small>오늘 방문</small><b>${s.today}</b></div>
      <div class="stat"><small>누적 방문</small><b>${s.total}</b></div>
      <div class="stat"><small>지금 접속</small><b>${s.online}</b></div>
    </div>
    <h3 class="admin-h">최근 14일 방문</h3>
    <div class="admin-bars">${days.map(([d, n]) => `<div title="${d} · ${n}명"><i style="height:${(n / max) * 100}%"></i><span>${d.slice(8)}</span></div>`).join('') || '<p class="muted small">아직 기록이 없어요</p>'}</div>
    <h3 class="admin-h">지금 사람이 있는 서버</h3>
    ${Object.keys(s.rooms || {}).length ? `<ul class="admin-rooms">${Object.entries(s.rooms).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [loc, no] = k.split('-'); return `<li><span>${locName(loc)} 서버 ${no}</span><b>${n}명</b></li>`; }).join('')}</ul>` : '<p class="muted small">지금은 접속한 사람이 없어요</p>'}
    <p class="muted small">방문은 기기마다 하루 한 번만 세요. 누가 왔는지는 남기지 않아요.</p>`;
}

async function open() {
  $('#admin-modal').hidden = false;
  const pw = getPw();
  $('#admin-login').hidden = !!pw;
  $('#admin-panel').hidden = !pw;
  if (pw) refresh();
  else setTimeout(() => $('#admin-pw').focus(), 50);
}

async function refresh() {
  const pw = getPw();
  if (!pw) return;
  $('#admin-stats').innerHTML = '<p class="muted small">불러오는 중…</p>';
  try { render(await fetchStats(pw)); setAdmin(true); }
  catch (e) {
    if (e.message === 'wrong') { setPw(''); setAdmin(false); $('#admin-login').hidden = false; $('#admin-panel').hidden = true; }
    else $('#admin-stats').innerHTML = '<p class="muted small">서버에 닿지 않았어요. 잠시 뒤 다시 눌러 주세요.</p>';
  }
}

$('#admin-btn').addEventListener('click', open);
$('#admin-refresh').addEventListener('click', refresh);
$('#admin-logout').addEventListener('click', () => { setPw(''); setAdmin(false); $('#admin-modal').hidden = true; });
$('#admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('#admin-pw').value.trim();
  if (!pw) return;
  $('#admin-err').textContent = '';
  try {
    const token = await login(pw);
    render(await fetchStats(token));
    setPw(token);
    setAdmin(true);
    $('#admin-pw').value = '';
    $('#admin-login').hidden = true;
    $('#admin-panel').hidden = false;
  } catch (err) {
    $('#admin-err').textContent = err.message === 'wrong' ? '비밀번호가 맞지 않아요' : '서버에 닿지 않았어요. 잠시 뒤 다시 해 주세요';
  }
});

// 새로고침: 브라우저가 기억해 둔 예전 파일(사이트가 10분 동안 기억하게 함)까지 새로 받아 와서 다시 연다
const FILES = ['index.html', 'style.css', 'js/main.js', 'js/data.js', 'js/avatar.js', 'js/blocky.js', 'js/world.js', 'js/net.js',
  'js/audio.js', 'js/scrolls.js', 'js/tip.js', 'js/admin.js', 'js/share.js'];
$('#btn-reload')?.addEventListener('click', async () => {
  await Promise.all(FILES.map((f) => fetch(f, { cache: 'reload' }).catch(() => {})));
  location.reload();
});

// 이 기기에 입장권이 있으면 열 때부터 관리자로 (30일 동안, "나가기"를 누르기 전까지)
if (getPw()) setAdmin(true);
