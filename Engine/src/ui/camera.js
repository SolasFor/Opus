/* Камера: плавный перелёт tweenCamera(), вписывание в кадр frameBox() и fitIfNeeded(), ракурсы cameraPreset()
 * и resetView(), фокус на детали focusOn().
 * M-02c: подраздел «camera» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * M-05b: предустановки — пункты меню «Камера» (#camMenu, aria-checked у выбранной). Центр кадра — в свободной
 * области между панелями (П-4): applyViewShift() сдвигает его через camera.setViewOffset (плавно при показе и скрытии
 * панелей), distFor() и fitIfNeeded() считают по пропорциям области, homePosition() — стартовый кадр.
 */
import * as THREE from 'three';
import { Ease, tween } from '../anim/tween.js';
import { CAM_HOME, TGT_HOME, V3 } from '../render/world.js';
import { camera, controls } from '../render/scene.js';
import { ui } from './state.js';
import { boundsWith } from './explode.js';
import { freeArea } from './layout.js';
import { viewShift, fitDistance, toFreeNdc, homeScale } from './free-area.js';

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
  return fitDistance(s.radius, camera.fov, innerWidth, innerHeight, freeArea(), pad);
}
function frameBox(box, dur = 1.2, delay = 0, dir = null) {
  const c = box.getCenter(new THREE.Vector3());
  const d = dir ? dir.clone().normalize() : camera.position.clone().sub(controls.target).normalize();
  tweenCamera(c.clone().addScaledVector(d, distFor(box)), c, dur, delay);
}
function fitIfNeeded(box) {
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(V3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const f = freeArea();
  const out = pts.some(p => { p.project(camera); const [x, y] = toFreeNdc(p.x, p.y, innerWidth, innerHeight, f); return Math.abs(x) > 0.92 || Math.abs(y) > 0.9 || p.z > 1; });
  if (out) frameBox(box, 1.1, 0.1);
}
const CAM_DIRS = { front: V3(0, 0.16, 1), side: V3(1, 0.18, 0.05), top: V3(0.001, 1, 0.12), iso: CAM_HOME.clone().sub(TGT_HOME) };
function cameraPreset(name) {
  ui.lastInteract = performance.now();
  frameBox(boundsWith({}), 1.1, 0, CAM_DIRS[name]);
  document.querySelectorAll('#camMenu [data-cam]').forEach(b => { const on = b.dataset.cam === name; b.classList.toggle('act', on); b.setAttribute('aria-checked', on); });
}
function resetView() { cameraPreset('iso'); }
const homePosition = () => CAM_HOME.clone().sub(TGT_HOME).multiplyScalar(homeScale(camera.fov, innerWidth, innerHeight, freeArea())).add(TGT_HOME);
const shift = { x: 0, y: 0, tw: null };
function setShift(x, y) {
  shift.x = x; shift.y = y;
  camera.setViewOffset(innerWidth, innerHeight, x, y, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
}
function applyViewShift(animate) {
  const to = viewShift(innerWidth, innerHeight, freeArea());
  if (shift.tw) { shift.tw.kill(); shift.tw = null; }
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { setShift(to.x, to.y); return; }
  const x0 = shift.x, y0 = shift.y;
  shift.tw = tween({ dur: 0.35, ease: Ease.inOutCubic, onUpdate: k => setShift(x0 + (to.x - x0) * k, y0 + (to.y - y0) * k), onComplete() { shift.tw = null; } });
}
function focusOn(node) {
  const box = new THREE.Box3().setFromObject(node);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = camera.position.clone().sub(controls.target).normalize();
  tweenCamera(c.clone().addScaledVector(dir, Math.max(r * 2.3, 2.6)), c, 1.0);
}

export { tweenCamera, frameBox, fitIfNeeded, cameraPreset, resetView, homePosition, applyViewShift, focusOn };
