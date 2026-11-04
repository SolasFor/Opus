/* Показания панелей в каждом кадре, updateHud(): угол цикла и ползунок угла, разборка, фишки порядка работы, диаграммы
 * фаз и p–V, блок «Сейчас» карточки детали.
 * M-05b: блок «HUD» функции frame() из Engine/src/main.js@307a0c0 перенесён дословно, без изменений.
 */
import { DEG, SPARK_ADV } from '../config/engine-spec.js';
import { mod } from '../sim/math.js';
import { sim, cycDeg, phaseOf } from '../render/kinematics.js';
import { ui, el } from './state.js';
import { meanProgress } from './explode.js';
import { updateLive } from './info.js';
import { drawTiming } from './charts/timing.js';
import { drawPV } from './charts/pv.js';
import { setRange } from './controls.js';

function updateHud() {
  const cd = cycDeg();
  if (!ui.scrubbing) setRange(el.angleSlider, Math.round(cd), cd / 7.2);
  else el.angleSlider.style.setProperty('--p', (+el.angleSlider.value / 7.2) + '%');
  el.angleVal.textContent = `${Math.round(mod(sim.theta / DEG, 360))}° · цикл ${Math.round(cd)}°`;
  const mp = meanProgress(), pct = Math.round(mp * 100);
  if (document.activeElement !== el.explodeSlider || ui.stepMode) setRange(el.explodeSlider, pct, pct);
  el.explodeVal.textContent = pct + '%';
  for (const c of el.fireChips) { const phi = phaseOf(+c.dataset.c); c.classList.toggle('hot', phi < 90 || phi > 720 - SPARK_ADV); }
  if (!el.cycle.classList.contains('hid')) { drawTiming(); if (!el.cycle.classList.contains('compact') && innerWidth > 760) drawPV(); }
  updateLive(false);
}

export { updateHud };
