/* Деталь «Ремень ГРМ и натяжной ролик»: buildBelt().
 * M-02b: подраздел 6.10 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { DEG, CRANK_Y } from '../../config/engine-spec.js';
import { clamp } from '../../sim/math.js';
import { CAM_Y, CAM_Z, BELT_X, R_CRANK_SPR, R_CAM_SPR, IDLER } from '../world.js';
import { M } from '../materials.js';
import { G, Parts, nodeMat } from './geometry.js';

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
  BP.build(g, g);
  g.userData.anchor.set(BELT_X, CAM_Y + 0.5, 0);
}

export { beltMat, idlerGroup, BELT_PITCH, buildBelt };
