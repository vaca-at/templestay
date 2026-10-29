// 앱 전체에서 쓰는 고정 데이터: 법당 위치, 캐릭터 유형, 옷, 동작, 닉네임

export const APP_ID = 'keunbeopdang-templestay-v1';
export const SERVER_COUNT = 12;
export const SERVER_CAP = 100;

// 법당 위치 3곳. 각 위치마다 외부 풍경(scene)과 내부 분위기(interior)가 다르다
export const LOCATIONS = [
  {
    id: 'forest',
    name: '숲울림당',
    place: '수목원 둘레 산자락',
    desc: '단풍 든 수목원 숲길을 따라 오르면 나오는 고요한 법당',
    sky: ['#9cc6e8', '#e9efe6'],
    fog: '#dfe7dc',
    interior: { wall: '#efe6d2', floor: '#4a2f22', pillar: '#6b2c22', beam: '#2f7d6d', accent: '#c8443a', lamp: '#ffd9a0' },
  },
  {
    id: 'river',
    name: '두물정사',
    place: '두물머리가 내려다보이는 산꼭대기',
    desc: '두 강이 하나로 만나는 물줄기가 발아래 펼쳐지는 산정 법당',
    sky: ['#f3c9a8', '#fbeee0'],
    fog: '#f1e3d6',
    interior: { wall: '#f2ebdd', floor: '#3d2a20', pillar: '#5c2a20', beam: '#24607a', accent: '#d9673b', lamp: '#ffe2b8' },
  },
  {
    id: 'sea',
    name: '해조암',
    place: '남해 섬들이 보이는 바위 절벽',
    desc: '절벽 끝 암자에서 다도해 섬들과 수평선을 바라보는 법당',
    sky: ['#7fb6e0', '#e6f1f6'],
    fog: '#d9e8ef',
    interior: { wall: '#ece8de', floor: '#3a2b24', pillar: '#55302a', beam: '#2c6f8f', accent: '#b8463f', lamp: '#fff0c8' },
  },
];

export const SKIN_TONES = ['#f4c9a6', '#e8b48c', '#d79b72', '#b97a55', '#8d5a3b'];

// 캐릭터 유형: head 모양과 장식(머리카락, 귀, 꼬리)이 다르다
// block: true 는 네모난 블록 사람(우리 캐릭터). 'own' 옷을 고르면 캐릭터 고유 차림을 입는다
export const CHAR_TYPES = [
  { id: 'moral', name: '도덕 선생님', desc: '남색 카디건, 단정한 깃', block: true },
  { id: 'appteacher', name: '앱 만드는 선생님', desc: '까만 머리, 안경, 초록 셔츠', block: true },
  { id: 'tycoon', name: '타이쿤 사장님', desc: '검은 정장에 빨간 넥타이', block: true },
  { id: 'trainee', name: '연수 듣는 선생님', desc: '파란 모자, 흰 셔츠, 목걸이 명찰', block: true },
  { id: 'planner', name: '시안 고르는 기획자', desc: '베레모, 분홍 니트', block: true },
  { id: 'knitdev', name: '초록 니트 개발자', desc: '줄무늬 초록 니트', block: true },
  { id: 'hoodie', name: '초록 후드 사장님', desc: '초록 후드티와 끈', block: true },
  { id: 'beige', name: '베이지 재킷 사장님', desc: '베이지 재킷, 검은 상의·바지', block: true },
];
// 예전에 저장된 둥근 캐릭터(동자, 보살 등)도 계속 그려지도록 avatar.js 에 남겨 둔다

// 옷: top 상의, bottom 하의, sash 가사·띠, style 별 세부 장식
export const OUTFITS = [
  { id: 'own', name: '캐릭터 기본 옷', cap: '블록 캐릭터 고유 차림', top: '#2f8a8c', bottom: '#2c3450', sash: '#3d8fc4', style: 'own' },
  { id: 'seungbok', name: '승복', cap: '회색 승복에 노란 띠', top: '#c9ccc8', bottom: '#b9bcb8', sash: '#e9d27a', style: 'robe' },
  { id: 'gasa', name: '가사장삼', cap: '갈색 장삼에 붉은 가사', top: '#8a6a4f', bottom: '#7a5c44', sash: '#c4532f', style: 'kasaya' },
  { id: 'hanbok', name: '생활한복', cap: '쪽빛 저고리와 고름', top: '#4f5f8f', bottom: '#d9d2c0', sash: '#e8a3a3', style: 'hanbok' },
  { id: 'lotus', name: '연꽃 법회복', cap: '하얀 옷에 연분홍 띠', top: '#f6f2ea', bottom: '#efe7d8', sash: '#e58fa6', style: 'robe' },
  { id: 'hiking', name: '등산복', cap: '산길 오르는 차림과 배낭', top: '#e2603d', bottom: '#3c4552', sash: '#2b7a6a', style: 'hiking' },
  { id: 'durumagi', name: '단풍 두루마기', cap: '가을빛 긴 두루마기', top: '#b5502e', bottom: '#d8c7a6', sash: '#f0c05a', style: 'coat' },
];

export const ACCESSORIES = [
  { id: 'none', name: '없음', cap: '장신구 빼기' },
  { id: 'beads', name: '염주 목걸이', cap: '목에 거는 염주' },
  { id: 'satgat', name: '삿갓', cap: '넓은 대나무 삿갓' },
  { id: 'beanie', name: '털모자', cap: '산바람 막는 모자' },
  { id: 'lotuspin', name: '연꽃 핀', cap: '머리에 꽂는 연꽃' },
  { id: 'backpack', name: '배낭', cap: '등에 메는 가방' },
];

// 동작. seatedOk: 앉은 채로 할 수 있는지. loop: 다시 누를 때까지 계속
export const ACTIONS = [
  { id: 'hapjang', name: '합장', cap: '두 손 모아 인사', verb: '합장으로 인사했어요', dur: 2.4 },
  { id: 'banbae', name: '반배', cap: '합장하고 허리 숙이기', verb: '반배를 올렸어요', dur: 2.6 },
  { id: 'keunjeol', name: '큰절', cap: '엎드려 절 올리기', verb: '부처님께 큰절을 올렸어요', dur: 4.2 },
  { id: 'beads', name: '염주', cap: '염주 돌리기 · 다시 누르면 멈춤', verb: '염주를 돌리기 시작했어요', loop: true },
  { id: 'moktak', name: '목탁', cap: '목탁 치기 · 다시 누르면 멈춤', verb: '목탁을 치기 시작했어요', loop: true },
  { id: 'meditate', name: '명상', cap: '고요히 앉아 숨 고르기', verb: '명상에 들었어요', loop: true },
  { id: 'wave', name: '손인사', cap: '손 흔들어 반기기', verb: '손을 흔들어 인사했어요', dur: 2.0 },
  { id: 'bae108', name: '108배', cap: '절 108번 · 횟수 세어 줌', verb: '108배를 시작했어요', loop: true },
];

const ADJ = ['맑은', '고요한', '포근한', '푸른', '은은한', '따스한', '느린', '작은', '새벽', '단정한', '환한', '조용한'];
const NOUN = ['빗방울', '솔바람', '연꽃', '물안개', '풍경소리', '반딧불', '산딸기', '도토리', '물결', '구름', '이슬', '달빛', '은행잎', '섬그늘'];
export const randomName = () =>
  ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];

export const GENDERS = [{ id: 'f', name: '여자', cap: '긴 웨이브 머리' }, { id: 'm', name: '남자', cap: '짧은 머리' }];

export const defaultLook = () => ({
  type: 'beige',
  gender: 'f',
  pet: 'claude',
  skin: SKIN_TONES[0],
  outfit: 'own',
  acc: 'none',
});
