/* Кинематика V12 60°: состояние модели sim, cycDeg и phaseOf, updateKinematics() —
 * общий 6-шейковый коленвал, 12 поршней и 12 шатунов в двух рядах (±30°), 4 распредвала, 48 клапанов и пружин,
 * общий зубчатый привод ГРМ (8 шкивов) и поликлиновой ремень навесных агрегатов (5 шкивов).
 */
import * as THREE from 'three';
import { DEG, CYLINDERS, FIRE_DEG, CRANK_R, ROD_L, CAM_LIFT, bankOf } from '../config/engine-spec.js';
import { cycleDeg, cylinderPhaseDeg } from '../sim/cycle.js';
import { camProfileLift, valveDownAngle, lobeAngle } from '../sim/valvetrain.js';
import { CYL_X, V3 } from './world.js';
import { crankGroup } from './parts/crankshaft.js';
import { rodMeshesA, rodMeshesB } from './parts/rods.js';
import { pistonMeshesA, pistonMeshesB } from './parts/pistons.js';
import { valveMeshesA, valveMeshesB, springMeshesA, springMeshesB, camShafts, valves, SPRING_H, SPRING_Y0 } from './parts/valvetrain.js';
import { beltMat, accBeltMat, beltTex, accTex, BELT_PITCH, ACC_PITCH, timingIdlers, accIdler } from './parts/belt.js';
import { altRotor, wpumpRotor, acRotor } from './parts/accessories.js';
import { timingDrive, accDrive } from './drive.js';

const sim = {
  theta: 0,
  running: false, speed: 1, slow: false,
  pistonR: new Array(CYLINDERS).fill(0),
  pistonY: new Array(CYLINDERS).fill(0),
  intakeLift: new Array(CYLINDERS).fill(0),
  exhaustLift: new Array(CYLINDERS).fill(0),
  heat: 0
};

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _qI = new THREE.Quaternion(), _up = V3(0, 1, 0), _d = new THREE.Vector3(), _one = V3(1, 1, 1);
const cycDeg = () => cycleDeg(sim.theta);
const phaseOf = i => cylinderPhaseDeg(sim.theta, i);

function updateKinematics() {
  const th = sim.theta;
  crankGroup.rotation.x = th;
  camShafts.forEach(cs => { cs.grp.rotation.x = th / 2; });

  for (let c = 0; c < CYLINDERS; c++) {
    const b = bankOf(c), idx = c % 6;
    const a = th - FIRE_DEG[c] * DEG;
    const pinYb = CRANK_R * Math.cos(a), pinZb = CRANK_R * Math.sin(a);
    const pr = pinYb + Math.sqrt(ROD_L * ROD_L - pinZb * pinZb);
    sim.pistonR[c] = pr;
    sim.pistonY[c] = pr;

    _m4.compose(_p.set(CYL_X[c], pr, 0), _qI, _one);
    (b === 0 ? pistonMeshesA : pistonMeshesB).forEach(m => m.setMatrixAt(idx, _m4));

    _d.set(0, pr - pinYb, -pinZb).normalize();
    _q.setFromUnitVectors(_up, _d);
    _m4.compose(_p.set(CYL_X[c], pinYb, pinZb), _q, _one);
    (b === 0 ? rodMeshesA : rodMeshesB).forEach(m => m.setMatrixAt(idx, _m4));
  }

  sim.intakeLift.fill(0);
  sim.exhaustLift.fill(0);
  for (let v = 0; v < valves.length; v++) {
    const vl = valves[v];
    const lift = camProfileLift(th / 2 + lobeAngle(vl.type, vl.cyl) - valveDownAngle(vl.bank, vl.type));
    vl.lift = lift;
    if (vl.type === 'intake') sim.intakeLift[vl.cyl] = lift / CAM_LIFT;
    else sim.exhaustLift[vl.cyl] = lift / CAM_LIFT;

    _p.copy(vl.seat).addScaledVector(vl.axis, -lift);
    _m4.compose(_p, vl.quat, _one);
    (vl.bank === 0 ? valveMeshesA : valveMeshesB).forEach(m => m.setMatrixAt(vl.idx, _m4));

    _p.copy(vl.seat).addScaledVector(vl.axis, SPRING_Y0);
    _s.set(1, (SPRING_H - lift) / SPRING_H, 1);
    _m4.compose(_p, vl.quat, _s);
    (vl.bank === 0 ? springMeshesA : springMeshesB).forEach(m => m.setMatrixAt(vl.idx, _m4));
  }

  for (const list of [pistonMeshesA, pistonMeshesB, rodMeshesA, rodMeshesB, valveMeshesA, valveMeshesB, springMeshesA, springMeshesB]) {
    list.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  const td = timingDrive(th);
  if (beltTex) beltTex.offset.x = td.s / BELT_PITCH;
  else if (beltMat && beltMat.map) beltMat.map.offset.x = td.s / BELT_PITCH;
  if (timingIdlers.tensR) timingIdlers.tensR.rotation.x = td.tensR;
  if (timingIdlers.valleyIdler) timingIdlers.valleyIdler.rotation.x = td.valleyIdler;
  if (timingIdlers.guideL) timingIdlers.guideL.rotation.x = td.guideL;

  const acc = accDrive(th);
  if (accTex) accTex.offset.x = acc.s / ACC_PITCH;
  else if (accBeltMat && accBeltMat.map) accBeltMat.map.offset.x = acc.s / ACC_PITCH;
  if (altRotor) altRotor.rotation.x = acc.alt;
  if (wpumpRotor) wpumpRotor.rotation.x = acc.wpump;
  if (acRotor) acRotor.rotation.x = acc.ac;
  if (accIdler) accIdler.rotation.x = acc.idler;
}

export { sim, _m4, _p, _s, _qI, cycDeg, phaseOf, updateKinematics };
