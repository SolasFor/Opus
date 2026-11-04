/* Деталь «ГРМ: 16 клапанов, пружины, два распредвала»: buildValvetrain().
 * M-02b: подраздел 6.6 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { VALVE_TILT } from '../../config/engine-spec.js';
import { camProfileLift, lobeAngle } from '../../sim/valvetrain.js';
import { CYL_X, SEAT_Y, SEAT_Z, TAPPET_TOP, CAM_RB, CAM_Y, CAM_Z, BELT_X, R_CAM_SPR, V3 } from '../world.js';
import { M } from '../materials.js';
import { G, extrudeX, gearShape, Parts } from './geometry.js';

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
  return new THREE.TubeGeometry(new Helix(), 90, 0.013, 5, false);
}
const SPRING_BASE = 0.52, SPRING_TOP = 0.96;
function buildValvetrain(g) {
  // valve template, +Y along the valve axis, face at y=0
  const VP = new Parts();
  VP.add(G.cyl(0.05, 0.135, 0.055, 26), M.valve, [0, 0.0275, 0]);
  VP.add(G.cyl(0.135, 0.135, 0.012, 26), M.valve, [0, 0.006, 0]);
  VP.add(G.cyl(0.028, 0.028, 0.96, 10), M.valve, [0, 0.53, 0]);
  VP.add(G.cyl(0.075, 0.06, 0.04, 16), M.chrome, [0, SPRING_TOP + 0.01, 0]);
  VP.add(G.cyl(0.10, 0.10, 0.12, 22), M.chrome, [0, TAPPET_TOP - 0.06, 0]);
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
    P.add(G.cylX(0.07, 4.95, 18), M.cam, [0.05, 0, 0]);
    [-2.2, -1.1, 0, 1.1, 2.2].forEach(x => P.add(G.cylX(0.1, 0.17, 20), M.cam, [x, 0, 0]));
    CYL_X.forEach((x, i) => [-0.17, 0.17].forEach(dx => P.add(lobe.clone(), M.cam, [x + dx, 0, 0], [lobeAngle(type, i), 0, 0])));
    P.add(extrudeX(gearShape(40, R_CAM_SPR - 0.025, R_CAM_SPR + 0.012), 0.14, 2), M.steelDark, [BELT_X, 0, 0]);
    P.add(G.cylX(0.30, 0.15, 6), M.aluDark, [BELT_X + 0.02, 0, 0]);
    for (let k = 0; k < 5; k++) {   // lightening holes look: dark bosses
      const a = k / 5 * Math.PI * 2;
      P.add(G.cylX(0.06, 0.16, 12), M.dark, [BELT_X, Math.cos(a) * 0.2, Math.sin(a) * 0.2]);
    }
    P.add(G.cylX(0.05, 0.08, 6), M.chrome, [BELT_X + 0.1, 0, 0]);
    P.build(cam, g);
    camShafts.push(cam);
  });
  lobe.dispose();
  g.userData.anchor.set(-1.65, CAM_Y + 0.35, -CAM_Z);
}

export { valveMeshes, springMeshes, camShafts, valves, SPRING_BASE, SPRING_TOP, buildValvetrain };
