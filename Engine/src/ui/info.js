/* Карточка детали: openInfo(), closeInfo() и блок «Сейчас» с живыми показаниями — liveRows(), updateLive().
 * M-02c: подраздел «info card» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * M-05b: карточка — раздел «Деталь» правой панели: при выборе детали раздел раскрывается, а панель показывается
 * (на планшете — правая шторка) и прокручивается к началу. Прежнего сжатия панели под карточкой (layoutPanels) больше нет.
 * M-05d: числа — по нормам ru-RU (ui/strings.ru.js): «18,5 бар», «180 °C», в справочных значениях неразрывный пробел
 * после числа. Блок «Сейчас» обновляется не чаще 10 раз в секунду (раз в 120 мс) и только при изменении текста;
 * aria-live у него выключен (в разметке), чтобы диктор не зачитывал каждое изменение.
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
import { S, unit, degrees, times, nb } from './strings.ru.js';

/* ---------- info card ---------- */
let liveTimer = 0, liveHtml = '';
function openInfo(node) {
  const info = node.userData.info;
  el.infoTag.textContent = info.tag;
  el.infoTitle.textContent = info.name;
  el.infoDesc.textContent = info.desc;
  el.infoSpecs.textContent = '';
  info.specs.forEach(([k, v]) => el.infoSpecs.insertAdjacentHTML('beforeend', `<div class="spec"><span>${k}</span><b>${nb(v)}</b></div>`));
  if (info.specs.some(([, v]) => v.includes('*'))) el.infoSpecs.insertAdjacentHTML('beforeend', `<div class="spec"><span>${S.starNote}</span></div>`);
  el.infoSpecs.insertAdjacentHTML('beforeend', `<div class="spec"><span>${S.modelNote}</span></div>`);
  el.btnIsolate.innerHTML = isolateLabel(ui.isolated === node);
  updateLive(true);
  el.infocard.classList.add('open');
  setSection('card', true);
  revealPanel('cycle');
  el.cycle.scrollTop = 0;                   // карточка — первый раздел панели: видна с заголовком и кнопкой ×
}
function closeInfo() { el.infocard.classList.remove('open'); el.infoLive.textContent = ''; liveHtml = ''; }
function liveRows(key) {
  const c = ui.pvCyl, phi = phaseOf(c), st = STROKES[strokeOf(phi)].name;
  const rpm = Math.round(effSpeed() * BASE_RPM * (sim.running ? 1 : 0));
  const xmm = (PIN_TDC - sim.pistonY[c]) * 100;   // мм от ВМТ, 0…72: 1 ед. = 100 мм (D-05)
  switch (key) {
    case 'crankshaft': return [['Угол поворота', degrees(Math.round(mod(sim.theta / DEG, 360)))], ['Угол в цикле', degrees(Math.round(cycDeg())) + ' из 720°'], ['Обороты модели', unit(rpm, 'об/мин')]];
    case 'pistons': return [[`Цилиндр ${c + 1}`, st], ['От ВМТ', unit(xmm, 'мм', 1)], ['Давление над поршнем', unit(pressureAt(phi), 'бар', 1)]];
    case 'rods': { const a = Math.asin(CRANK_R * Math.sin((sim.theta - FIRE_DEG[c] * DEG)) / ROD_L) / DEG; return [[`Наклон шатуна, ц. ${c + 1}`, degrees(a, 1)], ['Такт', st]]; }
    case 'valvetrain': return [[`Впускные, ц. ${c + 1}`, unit(sim.intakeLift[c] * CAM_LIFT * 100, 'мм', 1)], [`Выпускные, ц. ${c + 1}`, unit(sim.exhaustLift[c] * CAM_LIFT * 100, 'мм', 1)], ['Угол распредвала', degrees(Math.round(mod(sim.theta / DEG / 2, 360)))]];
    case 'sparks': { let best = 1e9, who = 0; for (let i = 0; i < 4; i++) { const d = mod(FIRE_DEG[i] - SPARK_ADV - cycDeg(), 720); if (d < best) { best = d; who = i; } } return [['Следующая искра', `цилиндр ${who + 1}`], ['Через', degrees(Math.round(best)) + ' поворота']]; }
    case 'intake': { const open = [0, 1, 2, 3].filter(i => sim.intakeLift[i] > 0.02).map(i => i + 1); return [['Открыт впуск', open.length ? 'ц. ' + open.join(', ') : '—'], ['Давление на впуске (модель)', unit(0.92, 'бар', 2)]]; }
    case 'exhaust': { const open = [0, 1, 2, 3].filter(i => sim.exhaustLift[i] > 0.02).map(i => i + 1); return [['Открыт выпуск', open.length ? 'ц. ' + open.join(', ') : '—'], ['Нагрев (модель)', unit(Math.round(180 + sim.heat * 720), '°C')]]; }
    case 'head': return [[`Камера ц. ${c + 1}`, st], ['Давление', unit(pressureAt(phi), 'бар', 1)], ['Объём', unit(volumeAt(phi), 'см³')]];
    case 'belt': return [['Распредвалы', degrees(Math.round(mod(sim.theta / DEG / 2, 360))) + ' (½ коленвала)'], ['Ролик', 'вращается ' + times(R_CRANK_SPR / IDLER.r, 2)]];
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
  const html = rows.length ? `<div class="ttl">${S.live}</div>` + rows.map(([k, v]) => `<div class="spec"><span>${k}</span><b>${v}</b></div>`).join('') : '';
  if (html !== liveHtml) { el.infoLive.innerHTML = html; liveHtml = html; }
}

export { openInfo, closeInfo, updateLive };
