/* Деталь «Поршни с кольцами (12 шт.)»: buildPistons().
 * По 6 кованых поршней со скошенной юбкой в каждом ряду V12 (BORE_R = 0.44, корпус 0.415, кольца 0.433).
 */
import * as THREE from 'three';
import { CRANK_Y, bankAngle } from '../../config/engine-spec.js';
import { M } from '../materials.js';
import { G, Parts, registerLocalPart } from './geometry.js';

let pistonMeshesA = [], pistonMeshesB = [];
const RING = [[0.168, 0.198], [0.114, 0.144], [0.044, 0.090]];

function buildPistonParts(parent, g) {
  const P = new Parts();
  const pr = [[0, 0.11], [0.27, 0.085, 1], [0.385, 0.02], [0.415, 0.02]];
  RING.slice().reverse().forEach(([a, b]) => pr.push([0.415, a], [0.386, a], [0.386, b], [0.415, b]));
  pr.push([0.415, 0.218], [0.410, 0.232, 1], [0.385, 0.240, 1], [0.26, 0.247, 1], [0, 0.250, 1]);
  P.add(G.lathe(pr, 44), M.piston);
  P.add(G.cyl(0.30, 0.31, 0.006, 36), M.soot, [0, 0.248, 0]);
  RING.forEach(([a, b], i) => {
    const ro = 0.433, ri = 0.388;
    if (i < 2) P.add(G.lathe([[ri, a + 0.002], [ro, a + 0.002], [ro, b - 0.002], [ri, b - 0.002]], 44), M.rings);
    else [a + 0.002, b - 0.012].forEach(y => P.add(G.lathe([[ri, y], [ro, y], [ro, y + 0.01], [ri, y + 0.01]], 44), M.rings));
  });
  const sk = [[0.386, -0.34], [0.412, -0.34], [0.412, 0.021], [0.386, 0.021], [0.386, -0.34]];
  [-0.95, Math.PI - 0.95].forEach(p0 => P.add(G.lathe(sk, 18, p0, 1.9), M.piston));
  [-1, 1].forEach(sx => {
    P.add(G.cylX(0.12, 0.09, 22), M.piston, [sx * 0.30, 0, 0]);
    P.add(G.rbox(0.09, 0.14, 0.24, 0.03), M.piston, [sx * 0.30, 0.06, 0]);
    P.add(G.cylX(0.088, 0.012, 18), M.rings, [sx * 0.355, 0, 0]);
  });
  P.add(G.cylX(0.085, 0.70, 22), M.chrome, [0, 0, 0]);
  return P.instanced(parent, g, 6);
}

function buildPistons(g) {
  const grpA = new THREE.Group(); grpA.rotation.x = bankAngle(0); g.add(grpA);
  const grpB = new THREE.Group(); grpB.rotation.x = bankAngle(1); g.add(grpB);
  pistonMeshesA = buildPistonParts(grpA, g);
  pistonMeshesB = buildPistonParts(grpB, g);
  registerLocalPart(g, grpA, [0, CRANK_Y, 0], [0, CRANK_Y + 1.86, -1.08]);
  registerLocalPart(g, grpB, [0, CRANK_Y, 0], [0, CRANK_Y + 1.86, +1.08]);
  g.userData.anchor.set(-0.595, 2.35, 0.95);
}

export { pistonMeshesA, pistonMeshesB, buildPistons };
