/* M-07d: навесное оборудование на узле «Блок цилиндров»: генератор и стартер (buildAccessories() из buildBlock()),
 * ротор генератора со шкивом altRotor — его поворачивает updateKinematics().
 * Генератор — низко спереди на стороне выпуска: литые крышки с вентиляционными окнами, пакет статора, крышка
 * регулятора с клеммой B+ и разъёмом, стяжные болты; качается на болте в бобышке литого кронштейна на стенке блока,
 * натяжение — планкой с пазом. Шкив — 6 канавок в плоскости ремня ACC_X (render/drive.js). Стартер — сзади на стороне
 * выпуска: корпус, крышка щёточного узла, тяговое реле с клеммами, редукторный нос со смещённой шестерней 11 зубьев;
 * шестерня выведена из зацепления — стоит перед венцом маховика.
 * Корпуса — в общем меше блока и только из его материалов, мелочь — ключи-цвета. Ротор — свой меш из steel
 * и steelDark (у блока их нет) и без корпусного материала: разрез его не срезает, ремень не висит в воздухе.
 */
import * as THREE from 'three';
import { M } from '../materials.js';
import { ACC_X, ALT, BELT_W, DRIVE } from '../drive.js';
import { G, extrudeX, extrudeXb, gearShape, Parts } from './geometry.js';

/* ---------- M-07d ACCESSORIES ---------- */
let altRotor = null;
const ALT_X0 = 1.95, ALT_R = 0.36;                                   // задний торец и радиус корпуса генератора
const ST = { z: 1.42, y: 0.82, r: 0.26, x0: -2.38, x1: -1.70 };      // ось и торцы электродвигателя стартера
const PIN = { z: 1.02, y: 0.70, x: -2.49, teeth: 11, rRoot: 0.075, rTip: 0.11, w: 0.08 };   // шестерня стартера
/* выпуклая оболочка двух окружностей в плоскости (−z, y) для extrudeX: дуги по наружным касательным */
function hull2(a, ra, b, rb) {
  const s = new THREE.Shape(), du = b[0] - a[0], dv = b[1] - a[1], f = Math.atan2(dv, du);
  const k = Math.acos((ra - rb) / Math.hypot(du, dv));
  s.absarc(a[0], a[1], ra, f + k, f - k + Math.PI * 2, false);
  s.absarc(b[0], b[1], rb, f - k, f + k, false);
  return s;
}
function alternator(P) {
  const y = ALT.v, z = ALT.u, at = x => [x, y, z], R = ALT_R;
  // задняя крышка, пакет статора, передняя крышка с бобышкой подшипника (оси вдоль +x)
  P.add(G.latheX([[0, 0], [0.26, 0], [0.30, 0.012, 1], [0.34, 0.04, 1], [R - 0.004, 0.08, 1], [R - 0.004, 0.24]], 48), M.aluCast, at(ALT_X0));
  const st = [[R - 0.004, 0]];
  for (let k = 0; k < 5; k++) st.push([R + 0.012, 0.004 + k * 0.022], [R + 0.012, 0.018 + k * 0.022], [R + 0.004, 0.022 + k * 0.022]);
  st.push([R - 0.004, 0.11]);
  P.add(G.latheX(st, 48), M.iron, at(ALT_X0 + 0.24));
  P.add(G.latheX([[R - 0.004, 0], [R - 0.004, 0.17], [0.34, 0.24, 1], [0.30, 0.268, 1], [0.14, 0.28], [0.13, 0.30], [0.075, 0.33], [0, 0.33]], 48), M.aluCast, at(ALT_X0 + 0.35));
  // вентиляционные окна на обеих крышках и на заднем торце
  for (let k = 0; k < 12; k++) {
    const a = (k + 0.5) / 12 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    [ALT_X0 + 0.15, ALT_X0 + 0.45].forEach(x => P.add(G.box(0.10, 0.014, 0.05), M.hole, [x, y + c * (R - 0.002), z + s * (R - 0.002)], [a, 0, 0]));
    if (k % 3) P.add(G.box(0.008, 0.085, 0.026), M.hole, [ALT_X0 + 0.628, y + c * 0.21, z + s * 0.21], [a, 0, 0]);
  }
  // стяжные болты по ободу задней крышки
  for (let k = 0; k < 4; k++) { const a = (k + 0.5) / 4 * Math.PI * 2;
    P.bolt(M.bolt, [ALT_X0 + 0.05, y + Math.cos(a) * 0.30, z + Math.sin(a) * 0.30], '-x', 0.022, 0.02); }
  // крышка регулятора, клемма B+ (шпилька, медная гайка, резиновый колпачок), разъём регулятора
  P.add(G.latheX([[0, 0], [0.21, 0], [0.22, 0.01, 1], [0.22, 0.04]], 40), M.paintBlack, at(ALT_X0 - 0.04));
  P.add(G.cylX(0.014, 0.08, 8), M.fitting, [ALT_X0 - 0.08, y + 0.10, z + 0.09]);
  P.add(G.hex(0.03, 0.022).rotateZ(Math.PI / 2), M.copper, [ALT_X0 - 0.07, y + 0.10, z + 0.09]);
  P.add(G.latheX([[0, 0], [0.05, 0], [0.05, 0.03, 1], [0.035, 0.06, 1], [0, 0.065]], 16), M.rubber, [ALT_X0 - 0.14, y + 0.10, z + 0.09]);
  P.add(G.rbox(0.10, 0.09, 0.13, 0.015), M.paintBlack, [ALT_X0 - 0.08, y - 0.06, z + 0.10]);
  P.add(G.box(0.05, 0.05, 0.08), M.hole, [ALT_X0 - 0.13, y - 0.06, z + 0.10]);
  // кронштейн на стенке блока: плита с болтами, бобышка оси качания, проушины корпуса, болт оси с гайкой
  P.add(G.rbox(0.36, 0.70, 0.10, 0.02), M.aluCast, [2.13, 0.05, 1.11]);
  [[2.03, 0.32], [2.23, 0.32]].forEach(([x, yy]) => P.bolt(M.bolt, [x, yy, 1.16], 'z', 0.03, 0.025));
  P.add(G.cylX(0.05, 0.18, 20), M.aluCast, [2.13, -0.26, 1.20]);
  [2.0, 2.27].forEach(x => P.add(G.cylX(0.062, 0.07, 20), M.aluCast, [x, -0.26, 1.20]));
  P.add(G.cylX(0.016, 0.40, 8), M.fitting, [2.135, -0.26, 1.20]);
  P.bolt(M.bolt, [2.335, -0.26, 1.20], 'x', 0.03, 0.025);
  P.add(G.hex(0.03, 0.025).rotateZ(Math.PI / 2), M.fitting, [1.94, -0.26, 1.20]);
  // планка натяжения с пазом и болт натяжения
  P.add(G.rbox(0.03, 0.06, 0.24, 0.01), M.iron, [2.33, 0.315, 1.25], [0.388, 0, 0]);
  P.add(G.box(0.004, 0.022, 0.13), M.hole, [2.347, 0.315, 1.25], [0.388, 0, 0]);
  P.bolt(M.bolt, [2.345, 0.27, 1.36], 'x', 0.026, 0.022);
}
function starter(P) {
  const at = x => [x, ST.y, ST.z], r = ST.r;
  // корпус электродвигателя (краска), крышка щёточного узла, стяжные шпильки с гайками
  P.add(G.latheX([[0, 0], [r - 0.012, 0], [r, 0.012, 1], [r, 0.488, 1], [r - 0.012, 0.50], [0, 0.50]], 40), M.paintBlack, at(ST.x0 + 0.03));
  P.add(G.latheX([[r - 0.01, 0], [r - 0.01, 0.06], [0.20, 0.12, 1], [0.10, 0.14], [0.05, 0.15], [0, 0.15]], 36), M.aluCast, at(ST.x1 - 0.15));
  [0.9, 0.9 + Math.PI].forEach(a => { const yy = ST.y + Math.cos(a) * (r + 0.004), zz = ST.z + Math.sin(a) * (r + 0.004);
    P.add(G.cylX(0.012, ST.x1 - ST.x0 - 0.04, 8), M.fitting, [(ST.x0 + ST.x1) / 2, yy, zz]);
    P.bolt(M.bolt, [ST.x1 - 0.02, yy, zz], 'x', 0.022, 0.02); });
  // фланец крепления к задней стенке блока с болтами, редукторный нос — оболочка осей двигателя и шестерни
  P.add(G.rbox(0.05, 0.42, 0.74, 0.02), M.aluCast, [ST.x0 + 0.005, 0.80, 1.25]);
  [0.66, 0.96].forEach(yy => P.bolt(M.bolt, [ST.x0 - 0.02, yy, 0.95], '-x', 0.03, 0.025));
  P.add(extrudeXb(hull2([-ST.z, ST.y], 0.22, [-PIN.z, PIN.y], 0.12), 0.10, 32, 0.01), M.aluCast, [ST.x0 - 0.05, 0, 0]);
  // кожух шестерни с наружной стороны — открыт к венцу
  const f = Math.atan2(PIN.y - 0.55, PIN.z), pin = x => [x, PIN.y, PIN.z];
  P.add(G.latheX([[0.125, 0], [0.15, 0], [0.15, 0.145], [0.125, 0.145]], 24, -f - 1.9, 3.8), M.aluCast, pin(ST.x0 - 0.165));
  // шестерня 11 зубьев на валу — выведена из зацепления: перед венцом, не в его плоскости
  P.add(extrudeX(gearShape(PIN.teeth, PIN.rRoot, PIN.rTip), PIN.w, 2), M.iron, pin(PIN.x));
  P.add(G.cylX(0.04, 0.16, 16), M.aluMach, pin(PIN.x + 0.04));
  // тяговое реле на корпусе: клеммы со шпильками и медными гайками, резиновый колпачок силовой клеммы
  const SY = ST.y + 0.30, SZ = ST.z - 0.14;
  P.add(G.latheX([[0, 0], [0.095, 0], [0.10, 0.01, 1], [0.10, 0.33, 1], [0.09, 0.345], [0.05, 0.35], [0.05, 0.37], [0, 0.37]], 32), M.aluMach, [ST.x0 + 0.02, SY, SZ]);
  [[0.045, 0.035, 0.016], [-0.05, -0.02, 0.01]].forEach(([dy, dz, rs]) => {
    P.add(G.cylX(rs, 0.06, 8), M.fitting, [ST.x0 + 0.41, SY + dy, SZ + dz]);
    P.add(G.hex(rs * 2.2, 0.02).rotateZ(Math.PI / 2), M.copper, [ST.x0 + 0.41, SY + dy, SZ + dz]); });
  P.add(G.latheX([[0, 0], [0.04, 0], [0.04, 0.03, 1], [0.028, 0.05, 1], [0, 0.055]], 16), M.rubber, [ST.x0 + 0.43, SY + 0.045, SZ + 0.035]);
}
/* ротор генератора: шкив с 6 канавками в плоскости ремня, шайба, гайка, конец вала */
function buildAltRotor(g) {
  altRotor = new THREE.Group();
  altRotor.position.set(ACC_X, ALT.v, ALT.u);
  g.add(altRotor);
  const R = new Parts(), r = DRIVE[1].r, h = BELT_W / 2;
  const pr = [[0, -0.13], [0.055, -0.13], [0.055, -0.082], [r + 0.006, -0.082], [r + 0.006, -h]];
  for (let k = 0; k < 6; k++) { const a = -h + k * BELT_W / 6; pr.push([r - 0.018, a + 0.012], [r, a + 0.024]); }
  pr.push([r + 0.006, h], [r + 0.006, h + 0.008], [0.10, h + 0.008], [0.095, h + 0.002], [0.06, h + 0.002], [0.055, h + 0.012], [0, h + 0.012]);
  R.add(G.latheX(pr, 48), M.steelDark);
  R.add(G.cylX(0.045, 0.006, 16), M.steelDark, [h + 0.015, 0, 0]);
  R.add(G.hex(0.034, 0.028).rotateZ(-Math.PI / 2), M.steel, [h + 0.03, 0, 0]);
  R.add(G.cylX(0.012, 0.03, 8), M.steel, [h + 0.055, 0, 0]);
  const ud = g.userData, housing = ud.housing;
  ud.housing = false; R.build(altRotor, g); ud.housing = housing;
}
function buildAccessories(P, g) {
  alternator(P);
  starter(P);
  buildAltRotor(g);
}

export { altRotor, ALT_X0, ALT_R, ST, PIN, buildAccessories };
