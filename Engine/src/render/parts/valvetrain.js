/* Деталь «ГРМ: 16 клапанов, пружины, два распредвала»: buildValvetrain().
 * M-02b: подраздел 6.6 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07c: по прототипу M-07 в тех же размерах: клапан-«тюльпан» с фаской седла, галтелью и канавкой сухарей, нагар
 * на тарелке, тарелка пружины с сухарями, стакан толкателя с фаской и шайбой; пружина плотнее; распредвалы
 * с шестигранником, звёздочки с ободом, облегчённым диском с настоящими отверстиями, ступицей и болтом.
 * Профиль кулачков, фазы, оси клапанов, седла и TAPPET_TOP прежние; шайба толкателя кончается на TAPPET_TOP.
 */
import * as THREE from 'three';
import { VALVE_TILT } from '../../config/engine-spec.js';
import { camProfileLift, lobeAngle } from '../../sim/valvetrain.js';
import { CYL_X, SEAT_Y, SEAT_Z, TAPPET_TOP, CAM_RB, CAM_Y, CAM_Z, BELT_X, R_CAM_SPR, V3 } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, extrudeXb, gearShape, Parts, holePath } from './geometry.js';

/* ---------- 6.6 VALVETRAIN: 16 valves (instanced), springs, 2 camshafts with sprockets ---------- */
let valveMeshes = [], springMeshes = [], camShafts = [];
const valves = [];   // {cyl, type, seat:Vector3, axis:Vector3, quat, lift}
function camLobeShape() {
  const s = new THREE.Shape();
  for (let k = 0; k <= 72; k++) {
    const a = k / 72 * Math.PI * 2;               // angle from +v (nose)
    const r = CAM_RB + camProfileLift(a);
    const u = Math.sin(a) * r, v = Math.cos(a) * r;
    if (k === 0) s.moveTo(u, v); else s.lineTo(u, v);
  }
  return s;
}
function springGeometry() {
  class Helix extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) { const a = t * Math.PI * 2 * 6.5; return out.set(Math.cos(a) * 0.068, t, Math.sin(a) * 0.068); }
  }
  return G.tube(new Helix(), 130, 0.013, 6);
}
const SPRING_BASE = 0.52, SPRING_TOP = 0.96;
function buildValvetrain(g) {
  // valve template, +Y along the valve axis, face at y=0
  const VP = new Parts();
  // tulip valve: face, 45° seat, fillet into the stem, keeper groove at the tip; carbon on the face
  VP.add(G.lathe([[0, 0], [0.135, 0], [0.135, 0.010], [0.118, 0.026], [0.085, 0.034, 1], [0.052, 0.050, 1], [0.036, 0.080, 1],
    [0.028, 0.125, 1], [0.028, 0.985], [0.024, 0.99], [0.024, 1.005], [0.028, 1.01], [0.028, 1.05], [0, 1.05]], 32), M.valve);
  VP.add(G.cyl(0.11, 0.11, 0.004, 32), M.carbon, [0, -0.001, 0]);
  // retainer in the bucket material (kept on the low level) + split keepers
  VP.add(G.lathe([[0.03, SPRING_TOP - 0.01], [0.078, SPRING_TOP - 0.01], [0.078, SPRING_TOP + 0.01], [0.06, SPRING_TOP + 0.03], [0.035, SPRING_TOP + 0.03]], 28), M.chrome);
  VP.add(G.cyl(0.036, 0.03, 0.05, 16), M.fittingDark, [0, SPRING_TOP + 0.03, 0]);
  // bucket tappet: chamfered cup, the shim on top ends at TAPPET_TOP
  VP.add(G.lathe([[0, TAPPET_TOP - 0.12], [0.10, TAPPET_TOP - 0.12], [0.10, TAPPET_TOP - 0.016], [0.092, TAPPET_TOP - 0.004], [0, TAPPET_TOP - 0.004]], 36), M.chrome);
  VP.add(G.cyl(0.07, 0.07, 0.004, 28), M.fittingDark, [0, TAPPET_TOP - 0.002, 0]);
  valveMeshes = VP.instanced(g, g, 16);
  const SP = new Parts();
  SP.add(springGeometry(), M.steelDark);
  springMeshes = SP.instanced(g, g, 16);
  springMeshes.forEach(m => { m.castShadow = false; });

  valves.length = 0;
  CYL_X.forEach((x, i) => ['intake', 'exhaust'].forEach(type => [-0.17, 0.17].forEach(dx => {
    const sz = type === 'intake' ? -1 : 1;
    const axis = V3(0, Math.cos(VALVE_TILT), sz * Math.sin(VALVE_TILT));
    valves.push({ cyl: i, type, seat: V3(x + dx, SEAT_Y, sz * SEAT_Z), axis,
      quat: new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), axis), lift: 0 });
  })));

  const lobe = extrudeX(camLobeShape(), 0.12, 1);
  camShafts = [];
  [['intake', -1], ['exhaust', 1]].forEach(([type, sz]) => {
    const cam = new THREE.Group();
    cam.position.set(0, CAM_Y, sz * CAM_Z);
    g.add(cam);
    const P = new Parts();
    P.add(G.cylX(0.07, 4.95, 24), M.cam, [0.05, 0, 0]);
    [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => P.add(G.cylX(0.1, 0.17, 32), M.cam, [x, 0, 0]));
    P.add(G.hex(0.095, 0.09).rotateZ(Math.PI / 2), M.cam, [2.36, 0, 0]);
    CYL_X.forEach((x, i) => [-0.17, 0.17].forEach(dx => P.add(lobe.clone(), M.cam, [x + dx, 0, 0], [lobeAngle(type, i), 0, 0])));
    // sprocket rim (40 teeth), web with real lightening holes, hub and bolt
    const gs = gearShape(40, R_CAM_SPR - 0.025, R_CAM_SPR + 0.012);
    gs.holes.push(holePath(0, 0, R_CAM_SPR - 0.06));
    P.add(extrudeX(gs, 0.14, 2), M.steelDark, [BELT_X, 0, 0]);
    const web = new THREE.Shape(); web.absarc(0, 0, R_CAM_SPR - 0.055, 0, Math.PI * 2, false);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; web.holes.push(holePath(Math.cos(a) * 0.235, Math.sin(a) * 0.235, 0.075)); }
    web.holes.push(holePath(0, 0, 0.07));
    P.add(extrudeXb(web, 0.09, 32, 0.008), M.aluDark, [BELT_X, 0, 0]);
    P.add(G.latheX([[0, -0.08], [0.11, -0.08], [0.11, 0.08], [0.09, 0.10], [0, 0.10]], 32), M.aluDark, [BELT_X, 0, 0]);
    P.bolt(M.bolt, [BELT_X + 0.10, 0, 0], 'x', 0.05, 0.045);
    P.build(cam, g);
    camShafts.push(cam);
  });
  lobe.dispose();
  g.userData.anchor.set(-1.65, CAM_Y + 0.35, -CAM_Z);
}

export { valveMeshes, springMeshes, camShafts, valves, SPRING_BASE, SPRING_TOP, buildValvetrain };
