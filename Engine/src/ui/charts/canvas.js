/* Графики панели «Работа двигателя» (canvas 2D): общее состояние charts, размер canvas с учётом devicePixelRatio,
 * setupCharts().
 * M-02c: начало подраздела «HUD charts» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import { el } from '../state.js';

/* ---------- HUD charts (canvas 2D) ---------- */
const charts = { dpr: 1, pvBg: null, trail: [] };
function sizeCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth || 288, h = +c.getAttribute('height');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px';
  return { w, h, dpr };
}
function setupCharts() {
  charts.t = sizeCanvas(el.timing);
  charts.p = sizeCanvas(el.pv);
  charts.pvBg = null;
}

export { charts, setupCharts };
