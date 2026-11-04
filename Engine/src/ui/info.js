/* Карточка детали: openInfo(), closeInfo() и блок «Сейчас» с живыми показаниями — liveRows(), updateLive().
 * M-02c: подраздел «info card» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * M-05b: карточка — раздел «Деталь» правой панели: при выборе детали раздел раскрывается, а панель показывается
 * (на планшете — правая шторка). Прежнего сжатия панели под карточкой (layoutPanels) больше нет.
 */
import { DEG, FIRE_DEG, CRANK_R, ROD_L, CAM_LIFT, SPARK_ADV } from '../config/engine-spec.js';
import { mod } from '../sim/math.js';
import { strokeOf } from '../sim/cycle.js';
import { PIN_TDC } from '../sim/kinematics.js';
import { volumeAt, pressureAt } from '../sim/thermo.js';
import { R_CRANK_SPR, IDLER, BASE_RPM, STROKES } from '../render/world.js';
import { sim, cycDeg, phaseOf } from '../render/kinematics.js';
import { ui, effSpeed, el } from './state.js';
import { revealPanel, setSection } from './layout.js';
import { isolateLabel } from './icons.js';

/* ---------- info card ---------- */
let liveTimer = 0;
function openInfo(node) {
  const info = node.userData.info;
  el.infoTag.textContent = info.tag;
  el.infoTitle.textContent = info.name;
  el.infoDesc.textContent = info.desc;
  el.infoSpecs.textContent = '';
  info.specs.forEach(([k, v]) => el.infoSpecs.insertAdjacentHTML('beforeend', `<div class="spec"><span>${k}</span><b>${v}</b></div>`));
  if (info.specs.some(([, v]) => v.includes('*'))) el.infoSpecs.insertAdjacentHTML('beforeend', '<div class="spec"><span>* иллюстративное значение</span></div>');
  el.infoSpecs.insertAdjacentHTML('beforeend', '<div class="spec"><span>Учебная модель: справочные значения иллюстративные</span></div>');
  el.btnIsolate.innerHTML = isolateLabel(ui.isolated === node);
  updateLive(true);
  el.infocard.classList.add('open');
  setSection('card', true);
  revealPanel('cycle');
}
function closeInfo() { el.infocard.classList.remove('open'); el.infoLive.textContent = ''; }
function liveRows(key) {
  const c = ui.pvCyl, phi = phaseOf(c), st = STROKES[strokeOf(phi)].name;
  const rpm = Math.round(effSpeed() * BASE_RPM * (sim.running ? 1 : 0));
  const xmm = (PIN_TDC - sim.pistonY[c]) * 100;   // мм от ВМТ, 0…72: 1 ед. = 100 мм (D-05)
  switch (key) {
    case 'crankshaft': return [['Угол поворота', Math.round(mod(sim.theta / DEG, 360)) + '°'], ['Угол в цикле', Math.round(cycDeg()) + '° из 720°'], ['Обороты модели', rpm + ' об/мин']];
    case 'pistons': return [[`Цилиндр ${c + 1}`, st], ['От ВМТ', xmm.toFixed(1) + ' мм'], ['Давление над поршнем', pressureAt(phi).toFixed(1) + ' бар']];
    case 'rods': { const a = Math.asin(CRANK_R * Math.sin((sim.theta - FIRE_DEG[c] * DEG)) / ROD_L) / DEG; return [[`Наклон шатуна, ц. ${c + 1}`, a.toFixed(1) + '°'], ['Такт', st]]; }
    case 'valvetrain': return [[`Впускные, ц. ${c + 1}`, (sim.intakeLift[c] * CAM_LIFT * 100).toFixed(1) + ' мм'], [`Выпускные, ц. ${c + 1}`, (sim.exhaustLift[c] * CAM_LIFT * 100).toFixed(1) + ' мм'], ['Угол распредвала', Math.round(mod(sim.theta / DEG / 2, 360)) + '°']];
    case 'sparks': { let best = 1e9, who = 0; for (let i = 0; i < 4; i++) { const d = mod(FIRE_DEG[i] - SPARK_ADV - cycDeg(), 720); if (d < best) { best = d; who = i; } } return [['Следующая искра', `цилиндр ${who + 1}`], ['Через', Math.round(best) + '° поворота']]; }
    case 'intake': { const open = [0, 1, 2, 3].filter(i => sim.intakeLift[i] > 0.02).map(i => i + 1); return [['Открыт впуск', open.length ? 'ц. ' + open.join(', ') : '—'], ['Давление на впуске (модель)', '0,92 бар']]; }
    case 'exhaust': { const open = [0, 1, 2, 3].filter(i => sim.exhaustLift[i] > 0.02).map(i => i + 1); return [['Открыт выпуск', open.length ? 'ц. ' + open.join(', ') : '—'], ['Нагрев (модель)', Math.round(180 + sim.heat * 720) + ' °C']]; }
    case 'head': return [[`Камера ц. ${c + 1}`, st], ['Давление', pressureAt(phi).toFixed(1) + ' бар'], ['Объём', volumeAt(phi).toFixed(0) + ' см³']];
    case 'belt': return [['Распредвалы', Math.round(mod(sim.theta / DEG / 2, 360)) + '° (½ коленвала)'], ['Ролик', 'вращается ×' + (R_CRANK_SPR / IDLER.r).toFixed(2)]];
    case 'block': return [0, 1, 2, 3].map(i => [`Цилиндр ${i + 1}`, STROKES[strokeOf(phaseOf(i))].name]);
  }
  return [];
}
function updateLive(force) {
  if (!ui.selected || !el.infocard.classList.contains('open')) return;
  const now = performance.now();
  if (!force && now - liveTimer < 120) return;
  liveTimer = now;
  const rows = liveRows(ui.selected.userData.key);
  el.infoLive.innerHTML = rows.length ? '<div class="ttl">Сейчас</div>' + rows.map(([k, v]) => `<div class="spec"><span>${k}</span><b>${v}</b></div>`).join('') : '';
}

export { openInfo, closeInfo, updateLive };
