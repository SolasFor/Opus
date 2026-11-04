/* Разборка: средний прогресс узлов meanProgress(), положения узлов applyExplode(), плавное следование за ползунком
 * smoothExplode(), остановка анимаций узлов killNodeTweens(), габариты двигателя при заданном прогрессе boundsWith().
 * M-02c: из подраздела «explode / steps» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * Режим шагов — в ui/steps.js: gotoStep() вызывает камеру, а камера — boundsWith(), поэтому они в разных модулях.
 */
import * as THREE from 'three';
import { clamp01 } from '../sim/math.js';
import { Ease } from '../anim/tween.js';
import { engineRoot } from '../render/scene.js';
import { nodesList } from '../render/parts/nodes.js';
import { ui } from './state.js';

/* ---------- explode / steps ---------- */
function meanProgress() { return nodesList.reduce((a, n) => a + n.userData.progress, 0) / nodesList.length; }
function applyExplode() {
  for (const n of nodesList) {
    const ud = n.userData, t = clamp01(ud.progress);
    const e = Ease.inOutCubic(t) * 0.25 + t * 0.75;   // a touch of ease even for the raw slider value
    n.position.lerpVectors(ud.originalPosition, ud.explodedPosition, e);
    for (const lp of ud.localParts) lp.object.position.lerpVectors(lp.orig, lp.expl, e);
  }
}
function smoothExplode(dt) {
  if (ui.stepMode) return;
  const k = 1 - Math.exp(-dt * 9);
  for (const n of nodesList) {
    const ud = n.userData;
    ud.progress += (ui.explode - ud.progress) * k;
    if (Math.abs(ui.explode - ud.progress) < 0.0005) ud.progress = ui.explode;
  }
}
function killNodeTweens() { nodesList.forEach(n => { if (n.userData.tw) { n.userData.tw.kill(); n.userData.tw = null; } }); }
/* bounds of the engine for a hypothetical set of node progress values */
function boundsWith(map) {
  const saved = nodesList.map(n => n.userData.progress);
  nodesList.forEach(n => { const k = n.userData.key; n.userData.progress = (typeof map === 'number') ? map : (map[k] ?? n.userData.progress); });
  applyExplode();
  engineRoot.updateMatrixWorld(true);
  const box = new THREE.Box3();
  nodesList.forEach(n => { if (!ui.isolated || ui.isolated === n) box.expandByObject(n); });
  nodesList.forEach((n, i) => { n.userData.progress = saved[i]; });
  applyExplode();
  engineRoot.updateMatrixWorld(true);
  return box;
}

export { meanProgress, applyExplode, smoothExplode, killNodeTweens, boundsWith };
