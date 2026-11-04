/* Кинематика: состояние модели sim, cycDeg и phaseOf, updateKinematics() — коленвал, поршни и шатуны, распредвалы,
 * клапаны и пружины, ремень ГРМ и ролик.
 * M-02b: раздел 7 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { DEG, FIRE_DEG, CRANK_Y, CRANK_R, ROD_L, CAM_LIFT } from '../config/engine-spec.js';
import { cycleDeg, cylinderPhaseDeg } from '../sim/cycle.js';
import { camProfileLift, valveDownAngle, lobeAngle } from '../sim/valvetrain.js';
import { CYL_X, R_CRANK_SPR, IDLER, V3 } from './world.js';
import { crankGroup } from './parts/crankshaft.js';
import { rodMeshes } from './parts/rods.js';
import { pistonMeshes } from './parts/pistons.js';
import { valveMeshes, springMeshes, camShafts, valves, SPRING_BASE, SPRING_TOP } from './parts/valvetrain.js';
import { beltMat, idlerGroup, BELT_PITCH } from './parts/belt.js';

const sim = {
  theta: 0,                // crank angle, rad (unbounded); cycle angle = θ mod 4π
  running: false, speed: 1, slow: false,
  pistonY: [0, 0, 0, 0], intakeLift: [0, 0, 0, 0], exhaustLift: [0, 0, 0, 0],
  heat: 0
};
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _qI = new THREE.Quaternion(), _up = V3(0, 1, 0), _d = new THREE.Vector3(), _one = V3(1, 1, 1);
const cycDeg = () => cycleDeg(sim.theta);
const phaseOf = i => cylinderPhaseDeg(sim.theta, i);                   // 0 = TDC, start of power stroke

function updateKinematics() {
  const th = sim.theta;
  crankGroup.rotation.x = th;
  camShafts.forEach(c => { c.rotation.x = th / 2; });
  for (let i = 0; i < 4; i++) {
    const a = th - FIRE_DEG[i] * DEG;
    const pinY = CRANK_Y + CRANK_R * Math.cos(a), pinZ = CRANK_R * Math.sin(a);
    const py = pinY + Math.sqrt(ROD_L * ROD_L - pinZ * pinZ);
    sim.pistonY[i] = py;
    _m4.compose(_p.set(CYL_X[i], py, 0), _qI, _one);
    pistonMeshes.forEach(m => m.setMatrixAt(i, _m4));
    _d.set(0, py - pinY, -pinZ).normalize();
    _q.setFromUnitVectors(_up, _d);
    _m4.compose(_p.set(CYL_X[i], pinY, pinZ), _q, _one);
    rodMeshes.forEach(m => m.setMatrixAt(i, _m4));
  }
  sim.intakeLift.fill(0); sim.exhaustLift.fill(0);
  for (let v = 0; v < valves.length; v++) {
    const vl = valves[v];
    // lift read straight off the actual cam lobe orientation → cams and valves can never disagree
    const lift = camProfileLift(th / 2 + lobeAngle(vl.type, vl.cyl) - valveDownAngle(vl.type));
    vl.lift = lift;
    if (vl.type === 'intake') sim.intakeLift[vl.cyl] = lift / CAM_LIFT; else sim.exhaustLift[vl.cyl] = lift / CAM_LIFT;
    _p.copy(vl.seat).addScaledVector(vl.axis, -lift);
    _m4.compose(_p, vl.quat, _one);
    valveMeshes.forEach(m => m.setMatrixAt(v, _m4));
    _p.copy(vl.seat).addScaledVector(vl.axis, SPRING_BASE);
    _s.set(1, SPRING_TOP - SPRING_BASE - lift, 1);
    _m4.compose(_p, vl.quat, _s);
    springMeshes.forEach(m => m.setMatrixAt(v, _m4));
  }
  [...pistonMeshes, ...rodMeshes, ...valveMeshes, ...springMeshes].forEach(m => { m.instanceMatrix.needsUpdate = true; });
  // belt teeth travel at the crank sprocket pitch speed; idler spins at v / r
  if (beltMat) beltMat.map.offset.x = th * R_CRANK_SPR / BELT_PITCH;
  if (idlerGroup) idlerGroup.rotation.x = th * R_CRANK_SPR / IDLER.r;
}

export { sim, _m4, _p, _s, _qI, cycDeg, phaseOf, updateKinematics };
