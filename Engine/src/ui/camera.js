/* Камера: плавный перелёт tweenCamera(), вписывание в кадр frameBox() и fitIfNeeded(), ракурсы cameraPreset()
 * и resetView(), фокус на детали focusOn().
 * M-02c: подраздел «camera» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { DEG } from '../config/engine-spec.js';
import { Ease, tween } from '../anim/tween.js';
import { CAM_HOME, TGT_HOME, V3 } from '../render/world.js';
import { camera, controls } from '../render/scene.js';
import { ui } from './state.js';
import { boundsWith } from './explode.js';

/* ---------- camera ---------- */
function tweenCamera(pos, target, dur = 1.0, delay = 0) {
  if (ui.camTw) ui.camTw.kill();
  let p0, t0;
  ui.camTw = tween({ dur, delay, ease: Ease.inOutCubic,
    onStart() { p0 = camera.position.clone(); t0 = controls.target.clone(); },
    onUpdate(k) { camera.position.lerpVectors(p0, pos, k); controls.target.lerpVectors(t0, target, k); },
    onComplete() { ui.camTw = null; } });
}
function distFor(box, pad = 1.18) {
  const s = box.getBoundingSphere(new THREE.Sphere());
  const fov = camera.fov * DEG, fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
  return s.radius / Math.sin(Math.min(fov, fovH) / 2) * pad * 0.92;
}
function frameBox(box, dur = 1.2, delay = 0, dir = null) {
  const c = box.getCenter(new THREE.Vector3());
  const d = dir ? dir.clone().normalize() : camera.position.clone().sub(controls.target).normalize();
  tweenCamera(c.clone().addScaledVector(d, distFor(box)), c, dur, delay);
}
function fitIfNeeded(box) {
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(V3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const out = pts.some(p => { p.project(camera); return Math.abs(p.x) > 0.92 || Math.abs(p.y) > 0.9 || p.z > 1; });
  if (out) frameBox(box, 1.1, 0.1);
}
const CAM_DIRS = { front: V3(0, 0.16, 1), side: V3(1, 0.18, 0.05), top: V3(0.001, 1, 0.12), iso: CAM_HOME.clone().sub(TGT_HOME) };
function cameraPreset(name) {
  ui.lastInteract = performance.now();
  frameBox(boundsWith({}), 1.1, 0, CAM_DIRS[name]);
  document.querySelectorAll('#camRow .btn').forEach(b => b.classList.toggle('act', b.dataset.cam === name));
}
function resetView() { cameraPreset('iso'); }
function focusOn(node) {
  const box = new THREE.Box3().setFromObject(node);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = camera.position.clone().sub(controls.target).normalize();
  tweenCamera(c.clone().addScaledVector(dir, Math.max(r * 2.3, 2.6)), c, 1.0);
}

export { tweenCamera, frameBox, fitIfNeeded, cameraPreset, resetView, focusOn };
