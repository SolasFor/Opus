/* Деталь «Шатуны (12 шт.)»: buildRods().
 * По 6 инстансированных шатунов в левом (−30°) и правом (+30°) рядах с разбегом по осям развала при разборке.
 */
import * as THREE from 'three';
import { DEG, CRANK_Y, ROD_L, bankAngle } from '../../config/engine-spec.js';
import { M } from '../materials.js';
import { G, extrudeXb, Parts, registerLocalPart, holePath, poly } from './geometry.js';

let rodMeshesA = [], rodMeshesB = [];

function rodOutline(withShank) {
  const s = new THREE.Shape();
  s.moveTo(0.26, 0.06); s.lineTo(0.26, -0.12); s.quadraticCurveTo(0.26, -0.32, 0.10, -0.325); s.lineTo(-0.10, -0.325);
  s.quadraticCurveTo(-0.26, -0.32, -0.26, -0.12); s.lineTo(-0.26, 0.06); s.quadraticCurveTo(-0.19, 0.17, -0.125, 0.22);
  if (withShank) { s.lineTo(-0.072, ROD_L - 0.12); s.absarc(0, ROD_L, 0.138, 238 * DEG, -58 * DEG, true); }
  s.lineTo(0.125, 0.22); s.quadraticCurveTo(0.19, 0.17, 0.26, 0.06);
  s.holes.push(holePath(0, 0, 0.125));
  return s;
}

function buildRodParts(parent, g) {
  const P = new Parts();
  const web = rodOutline(true); web.holes.push(holePath(0, ROD_L, 0.062));
  P.add(extrudeXb(web, 0.065, 22, 0.01), M.forged);
  [-1, 1].forEach(e => P.add(extrudeXb(poly([[e * 0.125, 0.22], [e * 0.088, 0.22], [e * 0.038, ROD_L - 0.135], [e * 0.072, ROD_L - 0.12]]), 0.118, 2, 0.008), M.forged));
  P.add(extrudeXb(rodOutline(false), 0.138, 22, 0.011), M.forged);
  const se = new THREE.Shape(); se.absarc(0, 0, 0.138, 0, Math.PI * 2, false); se.holes.push(holePath(0, 0, 0.062));
  P.add(extrudeXb(se, 0.12, 24, 0.01), M.forged, [0, ROD_L, 0]);
  P.add(G.box(0.142, 0.006, 0.525), M.boltDark, [0, -0.02, 0]);
  [-0.195, 0.195].forEach(z => {
    P.add(G.hex(0.04, 0.055), M.bolt, [0, -0.355, z]);
    P.add(G.cyl(0.02, 0.02, 0.028, 10), M.bolt, [0, -0.398, z]);
  });
  P.add(G.cylX(0.06, 0.11, 18), M.brass, [0, ROD_L, 0]);
  P.add(G.cylX(0.127, 0.092, 28), M.brass, [0, 0, 0]);
  return P.instanced(parent, g, 6);
}

function buildRods(g) {
  const grpA = new THREE.Group(); grpA.rotation.x = bankAngle(0); g.add(grpA);
  const grpB = new THREE.Group(); grpB.rotation.x = bankAngle(1); g.add(grpB);
  rodMeshesA = buildRodParts(grpA, g);
  rodMeshesB = buildRodParts(grpB, g);
  registerLocalPart(g, grpA, [0, CRANK_Y, 0], [0, CRANK_Y + 1.34, -0.78]);
  registerLocalPart(g, grpB, [0, CRANK_Y, 0], [0, CRANK_Y + 1.34, +0.78]);
  g.userData.anchor.set(0.51, CRANK_Y + 1.15, 0.65);
}

export { rodMeshesA, rodMeshesB, buildRods };
