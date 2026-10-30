// 앱 전체에서 쓰는 고정 데이터: 법당 위치, 캐릭터 유형, 옷, 동작, 닉네임

export const APP_ID = 'keunbeopdang-templestay-v1';
// 방 중계 서버 주소 (server/ 폴더의 Cloudflare Worker). 비어 있으면 브라우저끼리 직접 연결한다
export const RELAY_URL = 'https://templestay-rooms.bellachord.workers.dev';
// 관리자 구글 로그인 (Firebase Moon 프로젝트). apiKey 는 공개돼도 되는 값. 비어 있으면 구글 로그인 단추를 숨긴다
export const FIREBASE = { apiKey: 'AIzaSyA3CxawUPIfGeBWyffsNbCSM3ymjKHLH6o', authDomain: 'moon-d528d.firebaseapp.com', projectId: 'moon-d528d', appId: '1:126636401536:web:25b8a8296ec42b86f99765' };
export const SERVER_COUNT = 12;
export const SERVER_CAP = 100;

// 법당 위치 3곳. 각 위치마다 외부 풍경(scene)과 내부 분위기(interior)가 다르다
export const LOCATIONS = [
  {
    id: 'forest',
    name: '단풍 산',
    place: '수목원 둘레 산자락',
    desc: '단풍 든 수목원 숲길을 따라 오르면 나오는 고요한 법당',
    sky: ['#9cc6e8', '#e9efe6'],
    fog: '#dfe7dc',
    interior: { wall: '#efe6d2', floor: '#4a2f22', pillar: '#6b2c22', beam: '#2f7d6d', accent: '#c8443a', lamp: '#ffd9a0' },
  },
  {
    id: 'sea',
    name: '남해 윤슬',
    place: '남해 섬들이 보이는 바위 절벽',
    desc: '절벽 끝 암자에서 다도해 섬들과 수평선을 바라보는 법당',
    sky: ['#7fb6e0', '#e6f1f6'],
    fog: '#d9e8ef',
    interior: { wall: '#ece8de', floor: '#3a2b24', pillar: '#55302a', beam: '#2c6f8f', accent: '#b8463f', lamp: '#fff0c8' },
  },
  {
    id: 'river',
    name: '두물머리 물안개',
    place: '두물머리가 내려다보이는 산꼭대기',
    desc: '두 강이 하나로 만나는 물줄기가 발아래 펼쳐지는 산정 법당',
    sky: ['#f3c9a8', '#fbeee0'],
    fog: '#f1e3d6',
    interior: { wall: '#f2ebdd', floor: '#3d2a20', pillar: '#5c2a20', beam: '#24607a', accent: '#d9673b', lamp: '#ffe2b8' },
  },
];

// 불상 후보 (국립중앙박물관·국가유산청 3D 데이터, 공공누리 제1유형). 첫 번째가 기본 불상.
// zUp: 스캔이 Z축 위로 되어 있어 눕혀 세워야 함. height: 수미단 위 높이(기본 4.6)
export const BUDDHAS = {
  hapjang: { file: 'assets/buddha-hapjang.glb', name: '금동보살좌상 (판불)', from: '통일신라 · 합장', no: '국가유산청', height: 4.4 },
  duk2116: { file: 'assets/buddha.glb', name: '금동불좌상', from: '고려', no: '덕수2116' },
  kwanseum: { file: 'assets/buddha-kwanseum.glb', name: '금동관음보살좌상', from: '조선', no: '덕수3310' },
  iron: { file: 'assets/buddha-iron.glb', name: '철제여래좌상', from: '통일신라', no: '본관5191', zUp: true },
  stone: { file: 'assets/buddha-stone.glb', name: '부여 군수리 석조여래좌상', from: '백제', no: 'M번435' },
  gold: { file: 'assets/buddha-gold.glb', name: '경주 구황동 금제여래좌상', from: '통일신라', no: '본관14752', zUp: true },
};

export const SKIN_TONES = ['#f4c9a6', '#e8b48c', '#d79b72', '#b97a55', '#8d5a3b'];

// 캐릭터 유형: head 모양과 장식(머리카락, 귀, 꼬리)이 다르다
// block: true 는 네모난 블록 사람(우리 캐릭터). 'own' 옷을 고르면 캐릭터 고유 차림을 입는다
// 머리 스타일 (예전 '캐릭터'). id 는 저장된 값과 맞추려고 그대로 두고, 여자 · 남자 머리 이름을 따로 보여 줘요.
// name · desc 는 예전 차림 이름 (이제 옷 목록의 '…' 옷으로 옮겨 갔어요)
export const CHAR_TYPES = [
  { id: 'moral', hairF: '단발', hairM: '옆 가르마', color: '까만 머리', name: '남색 카디건', desc: '흰 깃이 보이는 단정한 차림', block: true },
  { id: 'appteacher', hairF: '낮은 묶음', hairM: '스포츠', color: '까만 머리', name: '안경과 초록 셔츠', desc: '동그란 안경, 초록 셔츠', block: true },
  { id: 'tycoon', hairF: '올림머리', hairM: '올백', color: '까만 머리', name: '검은 정장', desc: '빨간 넥타이를 맨 정장', block: true },
  { id: 'trainee', hairF: '땋은 머리', hairM: '바가지', color: '밤색 머리', name: '파란 모자', desc: '흰 셔츠에 목걸이 명찰', block: true },
  { id: 'planner', hairF: '웨이브', hairM: '가운데 가르마', color: '갈색 머리', name: '베레모와 분홍 니트', desc: '빨간 베레모, 연분홍 니트', block: true },
  { id: 'knitdev', hairF: '양갈래', hairM: '곱슬', color: '까만 머리', name: '초록 줄무늬 니트', desc: '포근한 줄무늬 스웨터', block: true },
  { id: 'hoodie', hairF: '숏컷', hairM: '투블럭', color: '짙은 갈색', name: '초록 후드티', desc: '모자 달린 후드와 끈', block: true },
  { id: 'beige', hairF: '긴 생머리', hairM: '묶은 머리', color: '갈색 머리', name: '베이지 재킷', desc: '검은 상의와 바지', block: true },
];
export const hairName = (t, gender) => (gender === 'm' ? t.hairM : t.hairF);
// 예전에 저장된 둥근 캐릭터(동자, 보살 등)도 계속 그려지도록 avatar.js 에 남겨 둔다

// 옷: top 상의, bottom 하의, sash 가사·띠, style 별 세부 장식
export const OUTFITS = [
  // 'own' 은 예전 값: 머리 스타일(type)에 딸린 차림. 지금은 아래 '…' 옷들로 따로 골라요
  { id: 'own', name: '캐릭터 기본 옷', cap: '블록 캐릭터 고유 차림', top: '#2f8a8c', bottom: '#2c3450', sash: '#3d8fc4', style: 'own', hidden: true },
  { id: 'wear_beige', name: '베이지 재킷', cap: '검은 상의와 바지', style: 'own', preset: 'beige' },
  { id: 'wear_moral', name: '남색 카디건', cap: '흰 깃이 보이는 단정한 차림', style: 'own', preset: 'moral' },
  { id: 'wear_tycoon', name: '검은 정장', cap: '빨간 넥타이', style: 'own', preset: 'tycoon' },
  { id: 'wear_appteacher', name: '초록 셔츠와 안경', cap: '동그란 안경', style: 'own', preset: 'appteacher' },
  { id: 'wear_trainee', name: '파란 모자와 명찰', cap: '흰 셔츠에 목걸이 명찰', style: 'own', preset: 'trainee' },
  { id: 'wear_planner', name: '베레모와 분홍 니트', cap: '빨간 베레모', style: 'own', preset: 'planner' },
  { id: 'wear_knitdev', name: '초록 줄무늬 니트', cap: '포근한 스웨터', style: 'own', preset: 'knitdev' },
  { id: 'wear_hoodie', name: '초록 후드티', cap: '모자 달린 후드와 끈', style: 'own', preset: 'hoodie' },
  { id: 'seungbok', name: '승복', cap: '회색 승복에 노란 띠', top: '#c9ccc8', bottom: '#b9bcb8', sash: '#e9d27a', style: 'robe' },
  { id: 'gasa', name: '가사장삼', cap: '갈색 장삼에 붉은 가사', top: '#8a6a4f', bottom: '#7a5c44', sash: '#c4532f', style: 'kasaya', hidden: true }, // 고르는 목록에서는 뺌 (예전에 고른 사람은 그대로 보임)
  { id: 'hanbok', name: '생활한복', cap: '쪽빛 저고리와 고름', top: '#4f5f8f', bottom: '#d9d2c0', sash: '#e8a3a3', style: 'hanbok' },
  { id: 'lotus', name: '연꽃 법회복', cap: '하얀 옷에 연분홍 띠', top: '#f6f2ea', bottom: '#efe7d8', sash: '#e58fa6', style: 'robe' },
  { id: 'hiking', name: '등산복', cap: '산길 오르는 차림과 배낭', top: '#e2603d', bottom: '#3c4552', sash: '#2b7a6a', style: 'hiking' },
  { id: 'durumagi', name: '단풍 두루마기', cap: '가을빛 긴 두루마기', top: '#b5502e', bottom: '#d8c7a6', sash: '#f0c05a', style: 'coat' },
  // 시안 (?gallery=newoutfits 에서만 보여요)
  { id: 'saehanbok', name: '연두 개량한복', cap: '연두 저고리에 흰 바지', top: '#a8c97a', bottom: '#f2ede2', sash: '#d96a6a', style: 'hanbok', preview: true },
  { id: 'suhaeng', name: '갈색 수행복', cap: '편안한 갈색 수행복', top: '#8a6a4a', bottom: '#7a5c3e', sash: '#c9a24a', style: 'robe', preview: true },
  { id: 'marine', name: '줄무늬 티셔츠', cap: '파란 가로줄 티셔츠', top: '#f4f4f2', bottom: '#3a4f7a', deco: 'stripes', decoC: '#2f5fa8', style: 'plain', preview: true },
  { id: 'raincoat', name: '노란 우비', cap: '비 오는 날 노란 우비', top: '#f2c94c', bottom: '#f2c94c', sash: '#f2c94c', style: 'coat', deco: 'buttons', decoC: '#2a2420', preview: true },
  { id: 'overalls', name: '청 멜빵바지', cap: '흰 티에 청 멜빵', top: '#f4f4f2', bottom: '#4a6fa5', deco: 'overalls', decoC: '#4a6fa5', style: 'plain', preview: true },
  { id: 'check', name: '체크 셔츠', cap: '빨간 체크 남방', top: '#b8433a', bottom: '#3a3f47', deco: 'check', decoC: '#2a2420', style: 'plain', preview: true },
  { id: 'puffer', name: '패딩 점퍼', cap: '겨울 산사 패딩', top: '#2f3e66', bottom: '#2a2a2c', deco: 'puffer', decoC: '#26345a', style: 'plain', preview: true },
  { id: 'track', name: '트레이닝복', cap: '흰 줄 세 개 운동복', top: '#2f6f62', bottom: '#2f6f62', deco: 'track', decoC: '#f4f4f2', style: 'plain', preview: true },
  { id: 'flowerdress', name: '꽃무늬 원피스', cap: '하늘색 바탕 작은 꽃', top: '#9cc4e4', bottom: '#9cc4e4', sash: '#9cc4e4', style: 'coat', deco: 'flowers', decoC: '#f4f4f2', preview: true },
  { id: 'dado', name: '다도복', cap: '차 마실 때 입는 베이지 옷', top: '#e6d9bf', bottom: '#cdbb98', sash: '#8a6a4a', style: 'robe', preview: true },
  { id: 'wizard', name: '보라 마법사 옷', cap: '별무늬 긴 옷과 망토 · 남녀 공용', top: '#5b3f94', bottom: '#4a3279', sash: '#f2c94c', style: 'wizard' },
  // 법당 안에서는 누구나 이 옷으로 갈아입는다 (고르는 목록에는 안 나옴)
  { id: 'monkgray', name: '스님 회색 옷', cap: '법당 안 차림', top: '#9b9e9b', bottom: '#8e918e', sash: '#7f827f', style: 'robe', hidden: true },
];

// 장소(scene)별로 입는 옷. 법당 안에서는 회색 승복, 모자·배낭은 벗는다
export function dressFor(look, scene) {
  if (scene !== 'in') return look;
  return { ...look, outfit: 'monkgray', acc: ['beads', 'bracelet', 'lotuspin'].includes(look.acc) ? look.acc : 'none' };
}

// 하루 활동. scene: 그 활동을 하러 가는 곳
// 장소 줄 순서: 법당 → 내 방 → 마당 → 공양간
export const SCENES = {
  in: { name: '법당', cap: '방석에 앉아 예불' },
  room: { name: '내 방', cap: '혼자 책 읽는 곳' },
  out: { name: '마당', cap: '절 주변 산보' },
  meal: { name: '공양간', cap: '발우공양 하는 곳' },
};

// 절기 행사: 한국 날짜로 기간 안이면 그 행사 이름 (확인용: 주소 끝 ?season=halloween 또는 ?season=none)
// 할로윈은 10월 24일 ~ 10월 31일. 11월 1일 0시가 되면 저절로 사라져요 (이미 고른 친구 · 장신구 모습은 남아요)
const SEASONS = [{ id: 'halloween', from: '10-24', to: '10-31' }];
export function season() {
  const q = new URLSearchParams(location.search).get('season');
  if (q) return q === 'none' ? null : q;
  const md = new Date(Date.now() + 9 * 3600e3).toISOString().slice(5, 10);
  return SEASONS.find((s) => s.from <= md && md <= s.to)?.id || null;
}
// 기간 한정 항목(season 이 붙은 것)은 그 행사 때만 고르는 목록에 보여요
export const inSeason = (item) => !item.season || item.season === season();

export const ACCESSORIES = [
  { id: 'none', name: '없음', cap: '장신구 빼기' },
  { id: 'beads', name: '염주 목걸이', cap: '목에 거는 염주' },
  { id: 'bracelet', name: '염주 팔찌', cap: '왼쪽 손목에 두른 염주' },
  { id: 'satgat', name: '삿갓', cap: '넓은 대나무 삿갓' },
  { id: 'lotuspin', name: '연꽃 핀', cap: '머리에 꽂는 연꽃' },
  { id: 'backpack', name: '배낭', cap: '등에 메는 회색 가방' },
  { id: 'witchhat', name: '보라 고깔모자', cap: '할로윈 한정 · 10/31까지', season: 'halloween' },
  // 시안 (?gallery=newacc 에서만 보여요, 고르는 목록에는 아직 안 나와요)
  { id: 'roundglasses', name: '동그란 안경', cap: '얇은 금테 안경', preview: true },
  { id: 'sunglasses', name: '선글라스', cap: '까만 네모 선글라스', preview: true },
  { id: 'scarf', name: '목도리', cap: '포근한 체크 목도리', preview: true },
  { id: 'knithat', name: '털모자', cap: '방울 달린 니트 모자', preview: true },
  { id: 'earmuffs', name: '귀마개', cap: '복슬복슬 하얀 귀마개', preview: true },
  { id: 'flowercrown', name: '꽃 화관', cap: '들꽃으로 엮은 화관', preview: true },
  { id: 'ribbon', name: '리본 핀', cap: '커다란 빨간 리본', preview: true },
  { id: 'headphones', name: '헤드폰', cap: '음악 듣는 헤드폰', preview: true },
  { id: 'strawhat', name: '밀짚모자', cap: '여름 산책 밀짚모자', preview: true },
  { id: 'bowtie', name: '나비넥타이', cap: '빨간 나비넥타이', preview: true },
];

// 동작. seatedOk: 앉은 채로 할 수 있는지. loop: 다시 누를 때까지 계속
export const ACTIONS = [
  { id: 'hapjang', name: '합장', cap: '두 손 모아 인사', verb: '합장으로 인사했어요', dur: 2.4 },
  { id: 'banbae', name: '반배', cap: '합장하고 허리 숙이기', verb: '반배를 올렸어요', dur: 2.6 },
  { id: 'keunjeol', name: '큰절', cap: '엎드려 절 올리기', verb: '부처님께 큰절을 올렸어요', dur: 4.2 },
  { id: 'beads', name: '염주', cap: '염주 돌리기 · 다시 누르면 멈춤', verb: '염주를 돌리기 시작했어요', loop: true },
  { id: 'moktak', name: '목탁', cap: '목탁 치기', verb: '목탁을 치기 시작했어요', loop: true },
  { id: 'meditate', name: '명상', cap: '고요히 앉아 숨 고르기', verb: '명상에 들었어요', loop: true },
  { id: 'wave', name: '손인사', cap: '손 흔들어 반기기', verb: '손을 흔들어 인사했어요', dur: 2.0 },
  { id: 'bae108', name: '108배', cap: '절 108번 · 횟수 세어 줌', verb: '108배를 시작했어요', loop: true },
  { id: 'eat', name: '발우공양', cap: '방석에 앉아 발우로 밥 먹기', verb: '발우공양을 시작했어요', loop: true, seat: true },
  { id: 'read', name: '책 읽기', cap: '책상 앞에서 책 펼치기', verb: '책을 펼쳤어요', loop: true, seat: true },
  { id: 'sagyeong', name: '사경', cap: '반야심경을 붓으로 한 글자씩', verb: '사경을 시작했어요', loop: true, seat: true },
  { id: 'tea', name: '차 마시기', cap: '따뜻한 차 한 잔', verb: '차를 마시기 시작했어요', loop: true },
  { id: 'walk', name: '산보', cap: '세 걸음마다 반배하며 마당 돌기', verb: '산보를 시작했어요' },
  { id: 'tapdori', name: '탑돌이', cap: '합장하고 탑을 오른쪽에 두고 돌기', verb: '탑돌이를 시작했어요', loop: true },
  { id: 'sweep', name: '마당 쓸기', cap: '빗자루로 쓱쓱 (울력)', verb: '마당을 쓸기 시작했어요', loop: true },
  { id: 'bell', name: '범종 치기', cap: '당목을 밀어 범종 울리기', verb: '범종을 치기 시작했어요', loop: true },
  { id: 'jukbi', name: '죽비', cap: '죽비를 손바닥에 쳐서 공양 시작 알리기', verb: '죽비를 치기 시작했어요', loop: true },
  { id: 'stones', name: '돌탑 쌓기', cap: '소원 담아 돌을 하나씩 올리기', verb: '돌탑을 쌓기 시작했어요', loop: true },
  { id: 'wash', name: '발우 씻기', cap: '공양을 마치고 발우 닦기', verb: '발우를 씻기 시작했어요', loop: true, seat: true },
];

// 장소마다 아래 동작 줄에 나오는 다섯 가지 (숫자 키 1~5 순서). seat: 방석에 앉아야 하는 동작이라 자동으로 앉아요
export const SCENE_ACTIONS = {
  in: ['hapjang', 'banbae', 'keunjeol', 'beads', 'bae108'],
  room: ['read', 'bae108', 'sagyeong', 'tea', 'meditate'],
  out: ['tapdori', 'stones', 'sweep', 'bell', 'hapjang'],
  meal: ['eat', 'hapjang', 'tea', 'wash', 'jukbi'],
};
// 장소에 따라 이름만 다르게 보이는 동작
export const SCENE_ACTION_NAMES = { meal: { hapjang: '공양 합장' } };

// 법명: 세 글자 + 세 글자 (14 × 30 = 420가지). 앞은 수행하는 마음, 뒤는 연꽃 · 물 · 달 · 잉어 · 산사 풍경
const ADJ = ['고요한', '청정한', '평온한', '온화한', '겸손한', '단아한', '소박한', '담담한', '그윽한', '넉넉한', '합장한', '깨어난', '공손한', '산사의'];
const NOUN = [
  '연꽃등', '백련화', '홍련잎', '청련화', '연향기', '연잎배', '연꽃잠', '연못빛',
  '물안개', '물소리', '물결빛', '이슬꽃', '안개숲', '시냇물',
  '달무리', '초승달', '보름달', '달빛결', '새벽달', '달마중', '달그늘',
  '은비늘', '금잉어',
  '솔바람', '풍경음', '대숲길', '산그늘', '구름결', '별초롱', '보리수',
];
export const randomName = () =>
  ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];

// 예전에 쓰던 낱말. 이 낱말로 저절로 지어진 법명이면 들어올 때 지금 낱말로 한 번 바꿔 줘요 (직접 지은 이름은 그대로)
const OLD_ADJ = ['맑은', '푸른', '느린', '작은', '새벽', '단정한', '환한', '조용한', '포근한', '은은한', '따스한', '해맑은', '잔잔한', '다정한', '산뜻한', '느긋한', '상냥한', '정다운', '향긋한', '정갈한'];
const OLD_NOUN = ['빗방울', '연꽃', '풍경소리', '반딧불', '산딸기', '도토리', '물결', '구름', '이슬', '달빛', '은행잎', '섬그늘', '풀피리', '꽃구름', '달맞이', '별무리', '종소리', '바람결', '이슬비', '들국화', '오솔길', '연못가',
  '연꽃잎', '연등불', '염주알', '연화대', '향내음', '절마당', '일주문', '탑돌이', '수미산', '극락조', '바라밀', '우담화', '감로수', '새벽종', '보리심', '자비심', '범종각',
  '처마끝', '돌계단', '옹달샘', '단풍잎', '동백꽃', '목련꽃', '솔방울', '새벽빛', '찻잎향'];
export function isOldAutoName(name) {
  const [a, b, more] = String(name || '').split(' ');
  if (more !== undefined || !b) return false;
  const adjOk = ADJ.includes(a) || OLD_ADJ.includes(a), nounOk = NOUN.includes(b) || OLD_NOUN.includes(b);
  return adjOk && nounOk && !(ADJ.includes(a) && NOUN.includes(b));
}

export const GENDERS = [{ id: 'f', name: '여자', cap: '여자 머리 스타일 8가지' }, { id: 'm', name: '남자', cap: '남자 머리 스타일 8가지' }];

// 체형: 얼굴은 같고 키·등신·체격만 달라요. k 전체 크기 · leg 다리 길이 · th 몸통 높이 · tw 어깨 너비 · head 머리 크기 · limb 팔다리 굵기
export const BODIES = [
  { id: 'base', label: '보통', k: 1, leg: 1, th: 1, tw: 1, head: 1, limb: 1 },
  { id: 'sturdy', label: '듬직한 체격', k: 1, leg: 1, th: 1, tw: 1.28, head: 1, limb: 1.25 },
  { id: 'petite', label: '아담한 키', k: 0.95, leg: 0.76, th: 0.92, tw: 1, head: 1, limb: 1 },
  { id: 'teen', label: '조금 작은 키', k: 0.9, leg: 0.9, th: 0.9, tw: 0.92, head: 1.03, limb: 0.92 },
  { id: 'child', label: '작은 키', k: 0.82, leg: 0.62, th: 0.72, tw: 0.86, head: 1.12, limb: 0.86 },
  { id: 'tiny', label: '아주 작은 키', k: 0.72, leg: 0.48, th: 0.58, tw: 0.82, head: 1.16, limb: 0.82 },
];
export const bodyOf = (look) => BODIES.find((b) => b.id === look?.body) || BODIES[0];

export const defaultLook = () => ({
  body: 'base',
  type: 'beige',
  gender: 'f',
  pet: 'claude',
  skin: SKIN_TONES[0],
  outfit: 'wear_beige',
  acc: 'none',
});
