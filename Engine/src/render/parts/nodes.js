/* Узлы модели: реестр nodes и nodesList, createNode() и сборка всех деталей buildEngine().
 * M-02b: из раздела 6 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * Здесь блок «nodes» без nodeMat и registerLocalPart и подраздел 6.11: buildEngine() присваивает
 * nodesList, поэтому они в одном модуле.
 * M-07c: buildEngine(low) — уровень детализации задаётся до сборки деталей (setDetail, render/parts/geometry.js).
 */
import * as THREE from 'three';
import { NODE_INFO } from '../../config/parts.js';
import { STEPS } from '../../config/steps.js';
import { V3 } from '../world.js';
import { engineRoot } from '../scene.js';
import { createMaterials } from '../materials.js';
import { setDetail } from './geometry.js';
import { buildBlock } from './block.js';
import { buildCrankshaft } from './crankshaft.js';
import { buildRods } from './rods.js';
import { buildPistons } from './pistons.js';
import { buildHead } from './head.js';
import { buildValvetrain } from './valvetrain.js';
import { buildSparks } from './sparks.js';
import { buildIntake } from './intake.js';
import { buildExhaust } from './exhaust.js';
import { buildBelt } from './belt.js';

/* ---------- nodes: one group per component, original/exploded positions ---------- */
const nodes = {}; let nodesList = [];
function createNode(key, offset, housing = false) {
  const g = new THREE.Group();
  const info = NODE_INFO[key];
  g.name = info.name;
  g.userData = { isNode: true, key, info, housing, progress: 0, tw: null,
    originalPosition: V3(0, 0, 0), explodedPosition: V3(offset[0], offset[1], offset[2]),
    localParts: [], mats: new Map(), opacity: 1, opacityTarget: 1, glow: 0, glowTarget: 0, glowColor: new THREE.Color(),
    anchor: V3(0, 0, 0) };
  engineRoot.add(g);
  nodes[key] = g;
  return g;
}

/* ---------- 6.11 BUILD ALL ---------- */
function buildEngine(low = false) {
  setDetail(low);
  createMaterials();
  buildBlock(createNode('block', [0, 1.55, 0], true));
  buildCrankshaft(createNode('crankshaft', [0, -1.95, 0]));
  buildRods(createNode('rods', [0, -0.75, 2.5]));
  buildPistons(createNode('pistons', [0, 1.0, 2.6]));
  buildHead(createNode('head', [0, 3.05, 0], true));
  buildValvetrain(createNode('valvetrain', [0, 4.75, 0]));
  buildSparks(createNode('sparks', [0, 6.6, 0]));
  buildIntake(createNode('intake', [0, 2.6, -2.3], true));
  buildExhaust(createNode('exhaust', [0, 2.0, 3.1], true));
  buildBelt(createNode('belt', [2.2, 0.4, 0]));
  nodesList = ['block', 'head', 'crankshaft', 'pistons', 'rods', 'valvetrain', 'belt', 'sparks', 'intake', 'exhaust'].map(k => nodes[k]);
  STEPS.forEach((st, i) => st.keys.forEach(k => { nodes[k].userData.stepIndex = i; }));
  nodesList.forEach(n => n.traverse(o => {
    if (o.isMesh) { o.userData.node = n; for (const m of [o.material]) { m.emissive.copy(m.userData.baseEmissive); } }
  }));
}

export { nodes, nodesList, buildEngine };
