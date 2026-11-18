/* Навесное оборудование V12 на узле «Блок цилиндров»:
 *   – генератор с вращающимся шкивом altRotor;
 *   – центральная водяная помпа в передней части развала со шкивом wpumpRotor;
 *   – компрессор кондиционера на левом борту с муфтой acRotor;
 *   – редукторный стартер перед 108-зубым венцом маховика.
 */
import * as THREE from 'three';
import { CRANK_Y } from '../../config/engine-spec.js';
import { BLOCK_HALF_L, FLYWHEEL_X } from '../world.js';
import { M } from '../materials.js';
import { ACC_X, ALT, WP, AC, BELT_W, DRIVE } from '../drive.js';
import { G, extrudeX, extrudeXb, gearShape, Parts } from './geometry.js';

let altRotor = null, wpumpRotor = null, acRotor = null;
const ALT_X0 = 2.82, ALT_R = 0.34;
const AC_X0 = 2.86, AC_R = 0.30;
const ST = { z: 1.46, y: 0.78, r: 0.25, x0: -3.32, x1: -2.62 };
const PIN = { z: 1.08, y: 0.66, x: -3.44, teeth: 11, rRoot: 0.075, rTip: 0.11, w: 0.08 };

function hull2(a, ra, b, rb) {
  const s = new THREE.Shape(), du = b[0] - a[0], dv = b[1] - a[1], f = Math.atan2(dv, du);
  const k = Math.acos((ra - rb) / Math.hypot(du, dv));
  s.absarc(a[0], a[1], ra, f + k, f - k + Math.PI * 2, false);
  s.absarc(b[0], b[1], rb, f - k, f + k, false);
  return s;
}

function buildPolyPulley(target, g, r) {
  const R = new Parts(), h = BELT_W / 2;
  const pr = [[0, -0.13], [0.055, -0.13], [0.055, -0.082], [r + 0.006, -0.082], [r + 0.006, -h]];
  for (let k = 0; k < 6; k++) { const a = -h + k * BELT_W / 6; pr.push([r - 0.018, a + 0.012], [r, a + 0.024]); }
  pr.push([r + 0.006, h], [r + 0.006, h + 0.008], [0.095, h + 0.008], [0.09, h + 0.002], [0.055, h + 0.002], [0.05, h + 0.012], [0, h + 0.012]);
  R.add(G.latheX(pr, 40), M.steelDark);
  R.add(G.cylX(0.042, 0.006, 16), M.steelDark, [h + 0.015, 0, 0]);
  R.add(G.hex(0.032, 0.026).rotateZ(-Math.PI / 2), M.steel, [h + 0.03, 0, 0]);
  R.add(G.cylX(0.012, 0.028, 8), M.steel, [h + 0.052, 0, 0]);
  const ud = g.userData, housing = ud.housing;
  ud.housing = false; R.build(target, g); ud.housing = housing;
}

function alternator(P) {
  const y = ALT.v, z = ALT.u, at = x => [x, y, z], R = ALT_R;
  P.add(G.latheX([[0, 0], [0.25, 0], [0.29, 0.012, 1], [0.33, 0.04, 1], [R - 0.004, 0.08, 1], [R - 0.004, 0.24]], 40), M.aluCast, at(ALT_X0));
  const st = [[R - 0.004, 0]];
  for (let k = 0; k < 5; k++) st.push([R + 0.012, 0.004 + k * 0.022], [R + 0.012, 0.018 + k * 0.022], [R + 0.004, 0.022 + k * 0.022]);
  st.push([R - 0.004, 0.11]);
  P.add(G.latheX(st, 40), M.iron, at(ALT_X0 + 0.24));
  P.add(G.latheX([[R - 0.004, 0], [R - 0.004, 0.17], [0.32, 0.24, 1], [0.28, 0.268, 1], [0.14, 0.28], [0.13, 0.30], [0.075, 0.33], [0, 0.33]], 40), M.aluCast, at(ALT_X0 + 0.35));
  for (let k = 0; k < 12; k++) {
    const a = (k + 0.5) / 12 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    [ALT_X0 + 0.15, ALT_X0 + 0.45].forEach(x => P.add(G.box(0.09, 0.014, 0.05), M.hole, [x, y + c * (R - 0.002), z + s * (R - 0.002)], [a, 0, 0]));
  }
  P.add(G.latheX([[0, 0], [0.20, 0], [0.21, 0.01, 1], [0.21, 0.04]], 32), M.paintBlack, at(ALT_X0 - 0.04));
  P.add(G.cylX(0.014, 0.08, 8), M.fitting, [ALT_X0 - 0.08, y + 0.10, z + 0.09]);
  P.add(G.hex(0.03, 0.022).rotateZ(Math.PI / 2), M.copper, [ALT_X0 - 0.07, y + 0.10, z + 0.09]);
  P.add(G.latheX([[0, 0], [0.045, 0], [0.045, 0.03, 1], [0.032, 0.055, 1], [0, 0.06]], 16), M.rubber, [ALT_X0 - 0.14, y + 0.10, z + 0.09]);
  P.add(G.rbox(0.32, 0.48, 0.14, 0.02), M.aluCast, [ALT_X0 + 0.24, y - 0.16, 1.18]);
  P.bolt(M.bolt, [ALT_X0 + 0.36, y - 0.32, 1.25], 'z', 0.03, 0.025);
}

function acCompressor(P) {
  const y = AC.v, z = AC.u, R = AC_R;
  P.add(G.latheX([[0, 0], [R - 0.02, 0], [R, 0.02, 1], [R, 0.48, 1], [R - 0.02, 0.50], [0.16, 0.52], [0.14, 0.58], [0, 0.58]], 36), M.aluCast, [AC_X0, y, z]);
  for (let k = 0; k < 4; k++) P.add(G.torusX(R + 0.005, 0.012, 6, 32), M.aluCast, [AC_X0 + 0.10 + k * 0.10, y, z]);
  P.add(G.rbox(0.18, 0.14, 0.18, 0.02), M.aluMach, [AC_X0 + 0.16, y + R + 0.02, z + 0.06]);
  P.bolt(M.bolt, [AC_X0 + 0.16, y + R + 0.09, z + 0.06], 'y', 0.025, 0.02);
  P.add(G.rbox(0.30, 0.42, 0.14, 0.02), M.aluCast, [AC_X0 + 0.22, y - 0.14, -1.16]);
  P.bolt(M.bolt, [AC_X0 + 0.32, y - 0.28, -1.23], '-z', 0.03, 0.025);
}

function waterPump(P) {
  const y = WP.v, z = WP.u;
  P.add(G.latheX([[0, 0], [0.24, 0], [0.24, 0.08], [0.15, 0.14, 1], [0.12, 0.26, 1], [0.09, 0.46], [0, 0.46]], 36), M.aluCast, [BLOCK_HALF_L - 0.04, y, z]);
  P.add(G.cylZ(0.065, 0.72, 16), M.aluCast, [BLOCK_HALF_L + 0.04, y + 0.10, z]);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    P.bolt(M.bolt, [BLOCK_HALF_L + 0.04, y + Math.cos(a) * 0.21, z + Math.sin(a) * 0.21], 'x', 0.02, 0.02);
  }
}

function starter(P) {
  const at = x => [x, ST.y, ST.z], r = ST.r;
  P.add(G.latheX([[0, 0], [r - 0.012, 0], [r, 0.012, 1], [r, 0.50, 1], [r - 0.012, 0.51], [0, 0.51]], 36), M.paintBlack, at(ST.x0 + 0.03));
  P.add(G.latheX([[r - 0.01, 0], [r - 0.01, 0.06], [0.19, 0.12, 1], [0.10, 0.14], [0.05, 0.15], [0, 0.15]], 32), M.aluCast, at(ST.x1 - 0.15));
  [0.9, 0.9 + Math.PI].forEach(a => {
    const yy = ST.y + Math.cos(a) * (r + 0.004), zz = ST.z + Math.sin(a) * (r + 0.004);
    P.add(G.cylX(0.012, ST.x1 - ST.x0 - 0.04, 8), M.fitting, [(ST.x0 + ST.x1) / 2, yy, zz]);
    P.bolt(M.bolt, [ST.x1 - 0.02, yy, zz], 'x', 0.022, 0.02);
  });
  P.add(G.rbox(0.05, 0.42, 0.74, 0.02), M.aluCast, [ST.x0 + 0.005, 0.76, 1.25]);
  P.add(extrudeXb(hull2([-ST.z, ST.y], 0.22, [-PIN.z, PIN.y], 0.12), 0.10, 28, 0.01), M.aluCast, [ST.x0 - 0.05, 0, 0]);
  const f = Math.atan2(PIN.y - CRANK_Y, PIN.z), pin = x => [x, PIN.y, PIN.z];
  P.add(G.latheX([[0.125, 0], [0.15, 0], [0.15, 0.145], [0.125, 0.145]], 24, -f - 1.9, 3.8), M.aluCast, pin(ST.x0 - 0.165));
  P.add(extrudeX(gearShape(PIN.teeth, PIN.rRoot, PIN.rTip), PIN.w, 2), M.iron, pin(PIN.x));
  P.add(G.cylX(0.04, 0.16, 16), M.aluMach, pin(PIN.x + 0.04));
  const SY = ST.y + 0.29, SZ = ST.z - 0.14;
  P.add(G.latheX([[0, 0], [0.095, 0], [0.10, 0.01, 1], [0.10, 0.33, 1], [0.09, 0.345], [0.05, 0.35], [0.05, 0.37], [0, 0.37]], 28), M.aluMach, [ST.x0 + 0.02, SY, SZ]);
  P.add(G.cylX(0.016, 0.06, 8), M.fitting, [ST.x0 + 0.41, SY + 0.045, SZ + 0.035]);
  P.add(G.hex(0.035, 0.02).rotateZ(Math.PI / 2), M.copper, [ST.x0 + 0.41, SY + 0.045, SZ + 0.035]);
  P.add(G.latheX([[0, 0], [0.04, 0], [0.04, 0.03, 1], [0.028, 0.05, 1], [0, 0.055]], 16), M.rubber, [ST.x0 + 0.43, SY + 0.045, SZ + 0.035]);
}

function buildAccessories(P, g) {
  alternator(P);
  acCompressor(P);
  waterPump(P);
  starter(P);

  altRotor = new THREE.Group(); altRotor.position.set(ACC_X, ALT.v, ALT.u); g.add(altRotor);
  buildPolyPulley(altRotor, g, DRIVE[1].r);

  wpumpRotor = new THREE.Group(); wpumpRotor.position.set(ACC_X, WP.v, WP.u); g.add(wpumpRotor);
  buildPolyPulley(wpumpRotor, g, DRIVE[3].r);

  acRotor = new THREE.Group(); acRotor.position.set(ACC_X, AC.v, AC.u); g.add(acRotor);
  buildPolyPulley(acRotor, g, DRIVE[4].r);
}

export { altRotor, wpumpRotor, acRotor, ALT_X0, ALT_R, ST, PIN, FLYWHEEL_X, buildAccessories };
