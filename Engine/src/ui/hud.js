/* Показания панелей в каждом кадре, updateHud(): угол цикла и ползунок угла, разборка, фишки порядка работы, диаграммы
 * фаз и p–V, блок «Сейчас» карточки детали.
 * M-05b: блок «HUD» функции frame() из Engine/src/main.js@307a0c0 перенесён сюда дословно (первый коммит M-05b), затем
 * изменён: текст меняется только при изменении значения; угол — крупно, угол цикла — мелко рядом; в заголовке раздела
 * «Разборка» — шаг или степень разборки; диаграммы рисуются, только когда правая панель показана и их раздел раскрыт,
 * а значение p–V в заголовке обновляется и в свёрнутом разделе. Строки «Фаз», полосы тактов на ленте времени и
 * «цикл N°», «Ц1 — такт» — ui/phases.js.
 * M-05d: числа и строки — из ui/strings.ru.js («35 %», «52°»); у ползунка разборки aria-valuetext — то же, что
 * в заголовке раздела, а пока ползунок в фокусе — его собственное значение.
 */
import { DEG, SPARK_ADV } from '../config/engine-spec.js';
import { mod } from '../sim/math.js';
import { STEPS } from '../config/steps.js';
import { sim, cycDeg, phaseOf } from '../render/kinematics.js';
import { ui, el } from './state.js';
import { meanProgress } from './explode.js';
import { updateLive } from './info.js';
import { updatePhases } from './phases.js';
import { pvValue, drawPV } from './charts/pv.js';
import { setRange } from './controls.js';
import { panelShown, sectionOpen } from './layout.js';
import { S, percent, degrees } from './strings.ru.js';

const setText = (node, s) => { if (node.textContent !== s) node.textContent = s; };
function explodeState(p) {
  if (ui.stepMode && ui.step >= 0) return S.stepShort(ui.step + 1, STEPS.length);
  return p === 0 ? S.assembled : p === 100 ? S.exploded : percent(p);
}
function updateHud() {
  const cd = cycDeg();
  if (!ui.scrubbing) setRange(el.angleSlider, Math.round(cd), cd / 7.2);
  else el.angleSlider.style.setProperty('--p', (+el.angleSlider.value / 7.2) + '%');
  setText(el.angleVal, degrees(Math.round(mod(sim.theta / DEG, 360))));
  const mp = meanProgress(), p = Math.round(mp * 100);
  if (document.activeElement !== el.explodeSlider || ui.stepMode) setRange(el.explodeSlider, p, p);
  setText(el.explodeVal, percent(p));
  const st = explodeState(p);
  setText(el.explodeHdr, st);
  // ползунок в фокусе: узлы догоняют его значение плавно, а диктор читает само значение
  const vt = document.activeElement === el.explodeSlider && !ui.stepMode ? explodeState(+el.explodeSlider.value) : st;
  if (el.explodeSlider.getAttribute('aria-valuetext') !== vt) el.explodeSlider.setAttribute('aria-valuetext', vt);
  for (const c of el.fireChips) { const phi = phaseOf(+c.dataset.c); c.classList.toggle('hot', phi < 90 || phi > 720 - SPARK_ADV); }
  const right = panelShown('cycle');
  updatePhases(cd, right && sectionOpen('phases'));
  if (right) { if (sectionOpen('pv')) drawPV(); else setText(el.pvVal, pvValue()); }
  updateLive(false);
}

export { updateHud };
