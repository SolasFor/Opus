/* Деталь «Зубчатый привод ГРМ и поликлиновой ремень навесного»: buildBelt().
 *   1) Общий 8-шкивный зубчатый ремень ГРМ на BELT_X (20 з. КВ, 4×40 з. РВ, 3 ролика с кронштейнами);
 *   2) 5-шкивный поликлиновой ремень 6PK на ACC_X (демпфер, генератор, натяжитель, помпа, A/C).
 */
import * as THREE from 'three';
import { BLOCK_HALF_L } from '../world.js';
import { M } from '../materials.js';
import {
  TIMING_X, TIMING_TENS_R, TIMING_VALLEY_R, TIMING_DRIVE,
  ACC_X, BELT_W, BELT_T, DRIVE,
  beltLoop, markPeriod
} from '../drive.js';
import { G, Parts, nodeMat } from './geometry.js';

let beltMat = null, accBeltMat = null, beltTex = null, accTex = null;
let BELT_PITCH = 0.0628, ACC_PITCH = 0.12;
let timingIdlers = {}, accIdler = null;

function makeBeltTexture(baseHex, toothHex, stripeHex, teethPerTile = 1) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 64);
  const w = 128 / teethPerTile;
  for (let i = 0; i < teethPerTile; i++) {
    ctx.fillStyle = toothHex;
    ctx.fillRect(i * w, 0, w * 0.45, 64);
    ctx.fillStyle = stripeHex;
    ctx.fillRect(i * w + w * 0.12, 8, w * 0.20, 48);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addQuad(pos, norm, uv, idx, p0, p1, p2, p3, nx, ny, nz, u0, u1) {
  // гарантируем правильный обход треугольников в сторону заданной нормали
  const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
  const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
  const flip = cx * nx + cy * ny + cz * nz < 0;

  const base = pos.length / 3;
  pos.push(...p0, ...p1, ...p2, ...p3);
  for (let k = 0; k < 4; k++) norm.push(nx, ny, nz);
  uv.push(u0, 0, u0, 1, u1, 1, u1, 0);
  if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  else      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function buildBeltGeometry(loop, xCenter, width, tOut, tIn, uvPeriod) {
  const pts = loop.pts, n = pts.length, hx = width * 0.5;
  const pos = [], norm = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const sb = i + 1 < n ? b.s : loop.length;
    const u0 = a.s / uvPeriod, u1 = sb / uvPeriod;

    const aO = [xCenter - hx, a.v + a.nv * tOut, a.u + a.nu * tOut];
    const aO2 = [xCenter + hx, aO[1], aO[2]];
    const bO = [xCenter - hx, b.v + b.nv * tOut, b.u + b.nu * tOut];
    const bO2 = [xCenter + hx, bO[1], bO[2]];

    const aI = [xCenter - hx, a.v - a.nv * tIn, a.u - a.nu * tIn];
    const aI2 = [xCenter + hx, aI[1], aI[2]];
    const bI = [xCenter - hx, b.v - b.nv * tIn, b.u - b.nu * tIn];
    const bI2 = [xCenter + hx, bI[1], bI[2]];

    const ny = (a.nv + b.nv) * 0.5, nz = (a.nu + b.nu) * 0.5;
    addQuad(pos, norm, uv, idx, aO, aO2, bO2, bO, 0,  ny,  nz, u0, u1); // внешняя спинка
    addQuad(pos, norm, uv, idx, aI2, aI, bI, bI2, 0, -ny, -nz, u0, u1); // внутренняя сторона
    addQuad(pos, norm, uv, idx, aO2, aI2, bI2, bO2,  1, 0, 0, u0, u1);  // передняя кромка (+X)
    addQuad(pos, norm, uv, idx, aI, aO, bO, bI,     -1, 0, 0, u0, u1);  // задняя кромка (-X)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

function buildRollerGroup(parent, g, x, y, z, r, w, capMat) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  parent.add(grp);
  const P = new Parts();
  P.add(G.cylX(r, w, 28), M.steel);
  P.add(G.cylX(r + 0.018, 0.012, 28), M.steelDark, [-w * 0.5 - 0.006, 0, 0]);
  P.add(G.cylX(r + 0.018, 0.012, 28), M.steelDark, [ w * 0.5 + 0.006, 0, 0]);
  P.add(G.cylX(r * 0.62, w + 0.014, 20), capMat);
  P.bolt(M.bolt, [w * 0.5 + 0.012, 0, 0], 'x', 0.032, 0.025);
  // радиальная метка вращения на торце ролика
  P.add(G.box(0.010, r * 0.45, 0.020), M.paintRed, [w * 0.5 + 0.010, r * 0.55, 0]);
  P.build(grp, g);
  return grp;
}

function buildBelt(g) {
  timingIdlers = {};
  const tLoop = beltLoop(TIMING_DRIVE, 5);
  BELT_PITCH = tLoop.length / Math.max(1, Math.round(tLoop.length / (Math.PI * 0.02)));

  beltTex = makeBeltTexture('#1b1d21', '#262930', '#d45a28', 1);
  const beltBase = M.belt.clone();
  beltBase.userData = { ...M.belt.userData };
  beltBase.map = beltTex;
  beltMat = nodeMat(g, beltBase);
  beltBase.dispose();

  const tGeo = buildBeltGeometry(tLoop, TIMING_X, BELT_W, 0.028, 0.004, BELT_PITCH);
  const tMesh = new THREE.Mesh(tGeo, beltMat);
  tMesh.castShadow = true;
  tMesh.receiveShadow = true;
  g.add(tMesh);

  const PB = new Parts();

  // ролики ГРМ (натяжной правый, центральный в развале V, обводной левый) + кронштейны к блоку
  timingIdlers.tensR = buildRollerGroup(g, g, TIMING_X, TIMING_DRIVE[1].v, TIMING_DRIVE[1].u, TIMING_TENS_R, BELT_W + 0.012, M.anodizedRed);
  timingIdlers.valleyIdler = buildRollerGroup(g, g, TIMING_X, TIMING_DRIVE[4].v, TIMING_DRIVE[4].u, TIMING_VALLEY_R, BELT_W + 0.012, M.anodizedBlue);
  timingIdlers.guideL = buildRollerGroup(g, g, TIMING_X, TIMING_DRIVE[7].v, TIMING_DRIVE[7].u, TIMING_TENS_R, BELT_W + 0.012, M.steelDark);

  const bx = BLOCK_HALF_L + 0.06;
  // кронштейны боковых роликов и гидравлический натяжитель ГРМ
  [1, -1].forEach(sz => {
    const zc = sz * 1.05;
    PB.add(G.rbox(0.24, 0.22, 0.14, 0.025), M.aluCast, [bx, 1.55, zc]);
    PB.add(G.cylX(0.055, 0.22, 16), M.aluMach, [TIMING_X - 0.14, 1.55, zc]);
  });
  PB.add(G.cyl(0.068, 0.068, 0.36, 18), M.aluMach, [bx + 0.04, 1.24, 1.05]);
  PB.add(G.cyl(0.028, 0.028, 0.16, 12), M.chrome, [bx + 0.04, 1.46, 1.05]);
  // центральный Y-кронштейн ролика развала V
  [-1, 1].forEach(sz => {
    PB.add(G.box(0.08, 0.92, 0.09), M.aluCast, [bx, 2.12, sz * 0.24], [sz * 0.48, 0, 0]);
  });
  PB.add(G.cylX(0.065, 0.24, 18), M.aluMach, [TIMING_X - 0.14, 2.55, 0]);

  // 5-шкивный поликлиновой ремень навесного оборудования на ACC_X
  const aLoop = beltLoop(DRIVE, 5);
  ACC_PITCH = markPeriod(aLoop.length);
  accTex = makeBeltTexture('#181a1e', '#22252b', '#e6e8ec', 1);
  const accBase = M.polyBelt.clone();
  accBase.userData = { ...M.polyBelt.userData };
  accBase.map = accTex;
  accBeltMat = nodeMat(g, accBase);
  accBase.dispose();

  const aGeo = buildBeltGeometry(aLoop, ACC_X, BELT_W, BELT_T, 0.008, ACC_PITCH);
  const aMesh = new THREE.Mesh(aGeo, accBeltMat);
  aMesh.castShadow = true;
  aMesh.receiveShadow = true;
  g.add(aMesh);

  // ролик натяжителя поликлинового ремня и подпружиненный рычаг
  const idl = DRIVE[2];
  accIdler = buildRollerGroup(g, g, ACC_X, idl.v, idl.u, idl.r - BELT_T, BELT_W + 0.012, M.aluMach);
  PB.add(G.rbox(0.18, 0.24, 0.12, 0.025), M.aluCast, [ACC_X - 0.15, idl.v - 0.14, idl.u - 0.14], [0.55, 0, 0]);
  PB.add(G.cylX(0.085, 0.14, 20), M.aluCast, [ACC_X - 0.18, idl.v - 0.26, idl.u - 0.26]);

  PB.build(g, g);
  g.userData.anchor.set(TIMING_X + 0.12, 2.35, 0.45);
}

export { beltMat, accBeltMat, beltTex, accTex, BELT_PITCH, ACC_PITCH, timingIdlers, accIdler, buildBelt };
