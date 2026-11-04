/* Показания панелей в каждом кадре, updateHud(): угол цикла и ползунок угла, разборка, фишки порядка работы, диаграммы
 * фаз и p–V, блок «Сейчас» карточки детали.
 * M-05b: блок «HUD» функции frame() из Engine/src/main.js@307a0c0 перенесён сюда дословно (первый коммит M-05b), затем
 * изменён: текст меняется только при изменении значения; угол — крупно, угол цикла — мелко рядом; в заголовке раздела
 * «Разборка» — шаг или степень разборки; диаграммы рисуются, только когда правая панель показана и их раздел раскрыт,
 * а значение p–V в заголовке обновляется и в свёрнутом разделе.
 */
import { DEG, SPARK_ADV } from '../config/engine-spec.js';
import { mod } from '../sim/math.js';
import { STEPS } from '../config/steps.js';
import { sim, cycDeg, phaseOf } from '../render/kinematics.js';
import { ui, el } from './state.js';
import { meanProgress } from './explode.js';
import { updateLive } from './info.js';
import { drawTiming } from './charts/timing.js';
import { pvValue, drawPV } from './charts/pv.js';
import { setRange } from './controls.js';
import { panelShown, sectionOpen } from './layout.js';

const setText = (node, s) => { if (node.textContent !== s) node.textContent = s; };
function explodeState(pct) {
  if (ui.stepMode && ui.step >= 0) return `шаг ${ui.step + 1}/${STEPS.length}`;
  return pct === 0 ? 'собран' : pct === 100 ? 'разобран' : pct + '%';
}
function updateHud() {
  const cd = cycDeg();
  if (!ui.scrubbing) setRange(el.angleSlider, Math.round(cd), cd / 7.2);
  else el.angleSlider.style.setProperty('--p', (+el.angleSlider.value / 7.2) + '%');
  setText(el.angleVal, Math.round(mod(sim.theta / DEG, 360)) + '°');
  setText(el.angleSub, `цикл ${Math.round(cd)}°`);
  const mp = meanProgress(), pct = Math.round(mp * 100);
  if (document.activeElement !== el.explodeSlider || ui.stepMode) setRange(el.explodeSlider, pct, pct);
  setText(el.explodeVal, pct + '%');
  setText(el.explodeHdr, explodeState(pct));
  for (const c of el.fireChips) { const phi = phaseOf(+c.dataset.c); c.classList.toggle('hot', phi < 90 || phi > 720 - SPARK_ADV); }
  if (panelShown('cycle')) {
    if (sectionOpen('phases')) drawTiming();
    if (sectionOpen('pv')) drawPV(); else setText(el.pvVal, pvValue());
  }
  updateLive(false);
}

export { updateHud };
