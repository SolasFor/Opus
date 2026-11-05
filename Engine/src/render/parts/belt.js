/* Деталь «Ремень ГРМ и натяжной ролик»: buildBelt().
 * M-02b: подраздел 6.10 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07d: поликлиновой ремень навесного оборудования (6 рёбер внутрь, спинка наружу) по петле beltLoop() из
 * render/drive.js — шкив демпфера, шкив генератора, ролик натяжителя по спинке; на спинке метка, на длину петли целое
 * число её шагов (markPeriod), шов не виден. Натяжитель: корпус пружины на передней стенке блока, рычаг за плоскостью
 * ремня, ролик accIdler. Рычаг и корпус — в том же меше, что кронштейн ролика ГРМ, и из тех же материалов.
 */
import * as THREE from 'three';
import { DEG, CRANK_Y } from '../../config/engine-spec.js';
import { clamp } from '../../sim/math.js';
import { CAM_Y, CAM_Z, BELT_X, R_CRANK_SPR, R_CAM_SPR, IDLER } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeXb, Parts, nodeMat, detail } from './geometry.js';
import { ACC_X, BELT_W, BELT_T, RIB_H, IDLER_R, DRIVE, beltLoop, markPeriod } from '../drive.js';

/* ---------- 6.10 TIMING BELT + IDLER ---------- */
let beltMat = null, idlerGroup = null, beltLength = 1;
const BELT_PITCH = Math.PI * 2 * R_CRANK_SPR / 20;
function beltPath() {
  // circles in CCW order in the (u=z, v=y) plane; belt wraps the convex hull
  const C = [
    { u: 0, v: CRANK_Y, r: R_CRANK_SPR + 0.012 },
    { u: IDLER.z, v: IDLER.y, r: IDLER.r },
    { u: CAM_Z, v: CAM_Y, r: R_CAM_SPR + 0.012 },
    { u: -CAM_Z, v: CAM_Y, r: R_CAM_SPR + 0.012 }
  ];
  const n = C.length, tang = [];
  for (let i = 0; i < n; i++) {
    const a = C[i], b = C[(i + 1) % n];
    const du = b.u - a.u, dv = b.v - a.v, L = Math.hypot(du, dv);
    const dx = du / L, dy = dv / L, g = Math.acos(clamp((a.r - b.r) / L, -1, 1));
    // normal = d rotated clockwise by g  (outward side of a CCW hull)
    const nx = dx * Math.cos(g) + dy * Math.sin(g), ny = dy * Math.cos(g) - dx * Math.sin(g);
    tang.push({ ang: Math.atan2(ny, nx) });
  }
  const pts = [];
  for (let i = 0; i < n; i++) {
    const c = C[i], aIn = tang[(i - 1 + n) % n].ang;
    let aOut = tang[i].ang;
    while (aOut < aIn) aOut += Math.PI * 2;
    const steps = Math.max(4, Math.ceil((aOut - aIn) / (6 * DEG)));
    for (let k = 0; k <= steps; k++) {
      const a = aIn + (aOut - aIn) * k / steps;
      pts.push(new THREE.Vector2(c.u + Math.cos(a) * c.r, c.v + Math.sin(a) * c.r));
    }
  }
  return pts;
}
function buildBelt(g) {
  const pts = beltPath();
  const n = pts.length, w = 0.13, th = 0.03;
  // cumulative length
  const s = [0];
  for (let i = 1; i <= n; i++) s.push(s[i - 1] + pts[i % n].distanceTo(pts[i - 1]));
  beltLength = s[n];
  const pos = [], uv = [], idx = [];
  // 4 faces: outer (+normal), inner, side +x, side −x; each a strip with n+1 columns
  const centroid = pts.reduce((a, p) => a.add(p), new THREE.Vector2()).multiplyScalar(1 / n);
  const outward = i => {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[(i + 1) % n];
    const t = p1.clone().sub(p0).normalize();
    const nn = new THREE.Vector2(t.y, -t.x);
    if (nn.dot(pts[i].clone().sub(centroid)) < 0) nn.negate();
    return nn;
  };
  const faces = [
    (p, nn) => [[BELT_X - w / 2, p.y + nn.y * th, p.x + nn.x * th], [BELT_X + w / 2, p.y + nn.y * th, p.x + nn.x * th]],
    (p) => [[BELT_X + w / 2, p.y, p.x], [BELT_X - w / 2, p.y, p.x]],
    (p, nn) => [[BELT_X + w / 2, p.y, p.x], [BELT_X + w / 2, p.y + nn.y * th, p.x + nn.x * th]],
    (p, nn) => [[BELT_X - w / 2, p.y + nn.y * th, p.x + nn.x * th], [BELT_X - w / 2, p.y, p.x]]
  ];
  faces.forEach(f => {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n], nn = outward(i % n);
      const [a, b] = f(p, nn);
      pos.push(...a, ...b);
      const u = s[i] / BELT_PITCH;
      uv.push(u, 0, u, 1);
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, nodeMat(g, M.belt));
  mesh.material.side = THREE.DoubleSide;
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  beltMat = mesh.material;
  beltMat.map = beltMat.map.clone();
  beltMat.map.needsUpdate = true;

  idlerGroup = new THREE.Group();
  idlerGroup.position.set(BELT_X, IDLER.y, IDLER.z);
  g.add(idlerGroup);
  const IP = new Parts();
  IP.add(G.cylX(IDLER.r, 0.15, 28), M.steel);
  IP.add(G.cylX(IDLER.r * 0.55, 0.17, 20), M.dark);
  IP.add(G.box(0.04, 0.05, 0.12), M.steelDark, [0.09, 0, 0]);
  IP.build(idlerGroup, g);
  const BP = new Parts();
  BP.add(G.box(0.06, 0.42, 0.10), M.steelDark, [BELT_X - 0.1, IDLER.y - 0.18, IDLER.z - 0.05], [0, 0, 0]);
  BP.add(G.cylX(0.05, 0.12, 12), M.chrome, [BELT_X - 0.1, IDLER.y - 0.36, IDLER.z - 0.05]);
  buildAccBelt(g, BP);   // M-07d
  BP.build(g, g);
  g.userData.anchor.set(BELT_X, CAM_Y + 0.5, 0);
}

/* ---------- M-07d ACCESSORY DRIVE BELT + TENSIONER ---------- */
let accBeltMat = null, accIdler = null, accTex = 1;
const TENS = { u: 0.80, v: 0.70, x: 2.645 };      // ось рычага натяжителя; плоскость рычага — между ремнями
/* сечение ремня (x поперёк, h по нормали наружу петли) по часовой стрелке: спинка, правая боковина, 6 рёбер справа
 * налево, левая боковина замыкает контур */
function accSection() {
  const w = BELT_W / 2, p = BELT_W / 6, out = [[-w, BELT_T], [w, BELT_T], [w, 0]];
  for (let k = 5; k >= 0; k--) { const x0 = -w + k * p; out.push([x0 + p * 0.64, -RIB_H], [x0 + p * 0.36, -RIB_H], [x0, 0]); }
  return out;
}
function buildAccBelt(g, BP) {
  const loop = beltLoop(DRIVE, detail.low ? 12 : 6), sec = accSection(), pts = loop.pts;
  accTex = markPeriod(loop.length);
  const col = [...pts, { ...pts[0], s: loop.length }];
  const pos = [], nor = [], uv = [], idx = [];
  // у каждой грани сечения свои вершины: кромки рёбер резкие, вдоль петли нормали плавные
  sec.forEach((A, e) => {
    const B = sec[(e + 1) % sec.length], dx = B[0] - A[0], dh = B[1] - A[1], l = Math.hypot(dx, dh), base = pos.length / 3;
    col.forEach(p => [[A, 0], [B, 1]].forEach(([[x, h], t]) => {
      pos.push(ACC_X + x, p.v + p.nv * h, p.u + p.nu * h);
      nor.push(-dh / l, p.nv * dx / l, p.nu * dx / l);
      uv.push(p.s / accTex, e === 0 ? t : 0);
    }));
    for (let i = 0; i < pts.length; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, nodeMat(g, M.polyBelt));
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  accBeltMat = mesh.material;
  accBeltMat.map = accBeltMat.map.clone();
  accBeltMat.map.needsUpdate = true;
  // ролик натяжителя по спинке: гладкий обод с буртиками, ступица, отверстия в диске — видно вращение
  const idl = DRIVE[2], ri = IDLER_R;
  accIdler = new THREE.Group();
  accIdler.position.set(ACC_X, idl.v, idl.u);
  g.add(accIdler);
  const RP = new Parts();
  RP.add(G.latheX([[0, -0.095], [ri + 0.008, -0.095], [ri + 0.008, -0.085], [ri, -0.08], [ri, 0.08], [ri + 0.008, 0.085],
    [ri + 0.008, 0.095], [0.062, 0.095], [0.06, 0.09], [0, 0.09]], 36), M.steel);
  RP.add(G.cylX(0.045, 0.21, 20), M.dark, [0.005, 0, 0]);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2;
    RP.add(G.cylX(0.012, 0.012, 10), M.dark, [0.092, Math.cos(a) * 0.072, Math.sin(a) * 0.072]); }
  RP.build(accIdler, g);
  // рычаг (за плоскостью ремня), корпус пружины на передней стенке блока, болты оси рычага и оси ролика
  const arm = new THREE.Shape(), a0 = [-TENS.u, TENS.v], a1 = [-idl.u, idl.v], f = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
  arm.absarc(a1[0], a1[1], 0.055, f - Math.PI / 2, f + Math.PI / 2, false);
  arm.absarc(a0[0], a0[1], 0.075, f + Math.PI / 2, f + Math.PI * 1.5, false);
  BP.add(extrudeXb(arm, 0.04, 16, 0.008), M.steelDark, [TENS.x, 0, 0]);
  BP.add(G.latheX([[0, 0], [0.10, 0], [0.10, 0.03], [0.085, 0.035], [0.085, 0.20, 1], [0.105, 0.21], [0.105, 0.25], [0, 0.25]], 32),
    M.steelDark, [TENS.x - 0.27, TENS.v, TENS.u]);
  BP.add(G.rbox(0.05, 0.05, 0.07, 0.01), M.steelDark, [TENS.x - 0.06, TENS.v + 0.1, TENS.u + 0.07]);
  BP.bolt(M.chrome, [TENS.x + 0.02, TENS.v, TENS.u], 'x', 0.04, 0.03);
  BP.add(G.cylX(0.03, 0.06, 12), M.chrome, [TENS.x + 0.04, idl.v, idl.u]);
  BP.bolt(M.chrome, [ACC_X + 0.105, idl.v, idl.u], 'x', 0.032, 0.025);
}

export { beltMat, idlerGroup, BELT_PITCH, buildBelt, accBeltMat, accIdler, accTex };
