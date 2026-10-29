# 큰법당 템플스테이

산·강·바다가 보이는 3D 법당에 캐릭터로 들어가 함께 합장하고, 절하고, 복전함에 소원을 올리는 웹앱.

- 정적 사이트: `index.html` + `js/` + `style.css` + `assets/buddha.glb` (빌드 단계 없음)
- 3D: Three.js 0.170 (jsDelivr CDN)
- 실시간: Trystero 0.21.8 (Nostr 신호 + WebRTC, 별도 서버 없음)
- 저장: 브라우저 localStorage (캐릭터, 내 소원, 위치별 머문 시간)

## 로컬에서 보기

ES 모듈이라 파일을 바로 열면 안 되고, 아무 정적 서버로 띄운다.

```
npx serve .
```

## 시안 화면용 주소

- `?demo=in&loc=forest&bots=30` 법당 안 (loc: forest, river, sea)
- `?demo=out&loc=sea&bots=6` 마당
- `?gallery=types` / `outfits` / `acc` 캐릭터 줄 세우기

## 자료 출처

불상 자료 · 국립중앙박물관, 금동불좌상·금동보살입상(덕수2116), 공공누리 제1유형.
원본 3D 스캔 중 좌불(`duk002116_002`)만 골라 텍스처 2048px, meshopt 압축으로 웹용 크기를 조정했다.
