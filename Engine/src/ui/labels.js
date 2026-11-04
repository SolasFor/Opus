/* Подписи деталей: buildLabels() и updateLabels() — положение над деталью, подсветка при наведении и выборе.
 * M-02c: подраздел «labels» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { camera } from '../render/scene.js';
import { nodesList } from '../render/parts/nodes.js';
import { ui, el } from './state.js';
import { select } from './selection.js';

/* ---------- labels ---------- */
const labelEls = new Map();
function buildLabels() {
  nodesList.forEach(n => {
    const d = document.createElement('div');
    d.className = 'lbl';
    d.innerHTML = `<span>${n.userData.info.short}</span><i></i>`;
    d.style.opacity = 0;
    d.querySelector('span').addEventListener('click', () => select(n));
    el.labels.appendChild(d);
    labelEls.set(n, d);
  });
}
const _a = new THREE.Vector3();
function updateLabels() {
  const W = innerWidth, H = innerHeight;
  labelEls.forEach((d, n) => {
    const visible = ui.labels && n.userData.opacity > 0.3 && n.visible;
    if (!visible) { if (d.style.opacity !== '0') d.style.opacity = 0; return; }
    _a.copy(n.userData.anchor);
    n.localToWorld(_a);
    _a.project(camera);
    if (_a.z > 1) { d.style.opacity = 0; return; }
    const x = (_a.x * 0.5 + 0.5) * W, y = (-_a.y * 0.5 + 0.5) * H;
    d.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    d.style.opacity = 1;
    d.classList.toggle('hl', ui.hover === n);
    d.classList.toggle('sel', ui.selected === n);
  });
}

export { buildLabels, updateLabels };
