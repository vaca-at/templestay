// 큰 3D 염주: 염주를 돌리면 바닥에 곧게 세운 고리가 엄지로 한 알씩 당겨 넘기듯 돌아가요.
// 내 캐릭터 옆에 사람만 한 크기로 서 있고, 기둥 같은 것에 가리지 않게 장면 위에 따로 그려요 (내 화면에만).
// 사람만 한 고리에 108알을 다 꿰면 알이 작아져서, 108을 나눈 36주 · 27주 · 18주로 알을 키우고 그만큼 여러 바퀴 돌려 108을 세요.
// 1: 36주 자단 · 2: 27주 보리자(통 모양 알) · 3: 18주 흑단 큰 알. 불상·탑 고르기 창에서 골라요 (확인용: 주소 끝 ?mala=1|2|3)
import * as THREE from 'three';

const DESIGNS = {
  1: { name: '36주 자단', count: 36, R: 0.66, wood: 0x5a2e1a, rough: 0.42, guru: 0xa8452f, cord: 0x8e2a20 },
  2: { name: '27주 보리자', count: 27, R: 0.64, wood: 0xd2b48c, rough: 0.6, guru: 0x7a2f22, cord: 0x6b4a2a, barrel: true },
  3: { name: '18주 흑단', count: 18, R: 0.6, wood: 0x241813, rough: 0.18, guru: 0xd98e2b, cord: 0xb3302a },
};

export const MALAS = Object.entries(DESIGNS).map(([id, d]) => ({ id, name: d.name, cap: `108알을 ${108 / d.count}바퀴로 세요` }));

const easeOutBack = (k) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const PULL = 0.38;   // 한 알을 당기는 데 걸리는 시간(초). 나머지는 쉬어요
const Y = new THREE.Vector3(0, 1, 0);

export class Mala3D {
  constructor(variant) {
    const d = this.d = DESIGNS[variant] || DESIGNS[1];
    this.slots = d.count + 1;   // 알 + 모주(어미 알) 한 자리
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();     // 카메라 쪽으로 돌아 서 있는 자리 (기울지 않고 곧게)
    this.inner = new THREE.Group();     // 당길 때 흔들림
    this.group.add(this.inner);
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a2a20, 1.1));
    this.key = new THREE.DirectionalLight(0xffffff, 2.4);
    this.scene.add(this.key, this.key.target);

    // 알 사이가 살짝 떠서 꿴 줄이 보이게
    this.r = (Math.PI * d.R / this.slots) * 0.9;
    const geo = new THREE.SphereGeometry(this.r, 32, 22);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: d.rough, metalness: 0.03 });
    this.beads = new THREE.InstancedMesh(geo, mat, d.count);
    this.beads.frustumCulled = false;
    const base = new THREE.Color(d.wood), c = new THREE.Color();
    for (let i = 0; i < d.count; i++) this.beads.setColorAt(i, c.copy(base).multiplyScalar(1 + Math.sin(i * 12.9898) * 0.12));   // 나뭇결처럼 알마다 조금씩 다른 빛깔
    this.inner.add(this.beads);
    this.inner.add(new THREE.Mesh(new THREE.TorusGeometry(d.R, this.r * 0.13, 8, 120), new THREE.MeshStandardMaterial({ color: d.cord, roughness: 0.8 })));

    this.guru = new THREE.Mesh(new THREE.SphereGeometry(this.r * 1.3, 32, 22), new THREE.MeshStandardMaterial({ color: d.guru, roughness: 0.25, metalness: 0.06 }));
    const tm = new THREE.MeshStandardMaterial({ color: d.cord, roughness: 0.85 });
    this.tassel = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.SphereGeometry(this.r * 0.45, 16, 10), tm);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(this.r * 0.15, this.r * 0.6, this.r * 3.6, 16, 1, true), tm);
    knot.position.y = -this.r * 1.6; tail.position.y = knot.position.y - this.r * 2;
    this.tassel.add(knot, tail);
    this.inner.add(this.guru, this.tassel);

    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(); this.tan = new THREE.Vector3();
    this.right = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  // 고리 위 자리: 0이 엄지 자리(3시 방향). 시계 방향으로 돌아 알이 엄지 위를 아래로 지나가요
  at(slot, v) {
    const a = -(slot / this.slots) * Math.PI * 2;
    return v.set(Math.cos(a) * this.d.R, Math.sin(a) * this.d.R, 0);
  }

  // t: 염주를 돌린 시간(초). 1초에 한 알
  update(t, me, camera, env) {
    const d = this.d, S = this.slots, whole = Math.floor(t), ph = t - whole;
    const k = Math.min(1, ph / PULL), pull = whole + easeOutBack(k);
    const pulling = ph < PULL ? Math.sin(k * Math.PI) : 0;
    for (let i = 0; i < d.count; i++) {
      const slot = (((i + 1 + pull) % S) + S) % S;
      this.at(slot, this.p);
      const near = Math.min(slot, S - slot);   // 엄지에서 몇 칸
      const big = 1 + 0.16 * Math.max(0, 1 - near) * pulling;
      // 보리자는 줄 방향으로 납작한 통 모양
      if (d.barrel) {
        const a = -(slot / S) * Math.PI * 2;
        this.q.setFromUnitVectors(Y, this.tan.set(Math.sin(a), -Math.cos(a), 0).negate());
        this.s.set(big, big * 0.78, big);
      } else { this.q.identity(); this.s.setScalar(big); }
      this.beads.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    this.beads.instanceMatrix.needsUpdate = true;
    this.at(((pull % S) + S) % S, this.guru.position);
    this.tassel.position.copy(this.guru.position);

    // 내 캐릭터 오른쪽에 곧게 세워, 카메라 쪽으로만 돌려요 (위아래로는 기울지 않게)
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    // 세로 휴대폰처럼 좁은 화면에서는 캐릭터 옆 빈자리에 들어가게 줄이고 붙여요
    const halfW = camera.position.distanceTo(me.group.position) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.92;
    const rad = d.R + this.r * 1.3, fit = Math.min(1, Math.max(0.45, (halfW - 0.35) / (2 * rad)));
    this.group.scale.setScalar(fit);
    this.group.position.copy(me.group.position).addScaledVector(this.right, Math.min(1.3, Math.max(0.35 + rad * fit, halfW - rad * fit)));
    this.group.position.y = me.group.position.y + 0.95;
    this.group.rotation.set(0, Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z), 0);
    // 당길 때마다 손에 들린 것처럼 살짝 흔들려요
    const jolt = Math.exp(-3 * ph) * Math.sin(ph * Math.PI * 2.4);
    this.inner.rotation.set(0, 0.18 * jolt, -0.03 * jolt);
    this.tassel.rotation.z = -this.inner.rotation.z * 1.5;   // 술은 늘 아래로 처지게

    this.key.position.copy(camera.position).addScaledVector(this.right, 2).add(this.up);
    this.key.target.position.copy(this.group.position);
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.7;
  }
}
