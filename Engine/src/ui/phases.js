/* «Фазы цилиндров» (П-10): четыре строки-кнопки — такты цилиндра за цикл 0–720° с номерами, метка искры, курсор угла
 * и текущий такт; строка выбирает цилиндр для p–V. Лента времени (П-9): под ползунком угла — такты выбранного цилиндра
 * с номерами, метки ВМТ и НМТ; рядом с углом — «цикл N°» и «Ц1 — рабочий ход».
 * M-05b: заменяет диаграмму на canvas ui/charts/timing.js. Строки и полосы — DOM, их строит initPhases(); updatePhases()
 * меняет классы и текст только при изменении такта, курсор — одной CSS-переменной --x.
 */
import { STROKES } from '../render/world.js';
import { strokeOf } from '../sim/cycle.js';
import { phaseOf } from '../render/kinematics.js';
import { ui, el } from './state.js';
import { STROKE_NUM, STROKE_CLS, pctOf, strokeSpans, deadCentres, sparkAt } from './phase-scale.js';

const ph = { rows: [], segs: [], now: [], band: [], cyl: -1, s: [], bs: -1 };
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const setText = (n, s) => { if (n.textContent !== s) n.textContent = s; };
const edge = d => (d === 0 ? ' first' : d === 720 ? ' last' : '');
// полоса тактов цилиндра i: отрезки по тактам, номер — на более длинном отрезке такта
function fillBar(bar, i) {
  const segs = [];
  for (let k = 0; k < 4; k++) {
    const spans = strokeSpans(i, k), main = spans.reduce((m, s) => (s[1] - s[0] > m[1] - m[0] ? s : m));
    segs[k] = spans.map(s => {
      const g = node('span', 'stk ' + STROKE_CLS[k], s === main ? String(STROKE_NUM[k]) : '');
      g.style.left = pctOf(s[0]); g.style.width = pctOf(s[1] - s[0]);
      bar.append(g); return g;
    });
  }
  return segs;
}
const mark = (segs, s) => segs.forEach((list, k) => list.forEach(g => g.classList.toggle('now', k === s)));
function initPhases() {
  el.phases.textContent = '';
  ph.rows = []; ph.segs = []; ph.now = []; ph.s = []; ph.cyl = -1; ph.bs = -1;
  for (let i = 0; i < 4; i++) {
    const row = node('button', 'ph-row'), bar = node('span', 'ph-bar');
    row.type = 'button'; row.dataset.c = i; row.title = `Цилиндр ${i + 1} — показать p–V`;
    row.setAttribute('aria-pressed', String(i === ui.pvCyl));
    bar.setAttribute('aria-hidden', 'true');
    ph.segs[i] = fillBar(bar, i);
    const sp = node('i', 'spark'); sp.style.left = pctOf(sparkAt(i)); bar.append(sp);
    ph.now[i] = node('span', 'ph-now');
    row.append(node('span', 'ph-c', 'Ц' + (i + 1)), bar, ph.now[i]);
    el.phases.append(row); ph.rows.push(row);
  }
  const scale = node('div', 'ph-scale'), sc = node('span', 'ph-bar');
  scale.setAttribute('aria-hidden', 'true');
  [0, 180, 360, 540, 720].forEach(d => { const t = node('span', 'tick' + edge(d), d + '°'); t.style.left = pctOf(d); sc.append(t); });
  scale.append(node('span'), sc, node('span'));
  el.phases.append(scale);
  el.phaseRows = ph.rows;
}
function buildBand(i) {
  el.tlBands.textContent = ''; el.tlTicks.textContent = '';
  ph.band = fillBar(el.tlBands, i);
  for (const m of deadCentres(i)) {
    const t = node('span', 'tick' + edge(m.deg), m.name);
    t.style.left = pctOf(m.deg); el.tlTicks.append(t);
  }
  ph.cyl = i; ph.bs = -1;
}
// cd — угол цикла 0–720°; rows — строки «Фаз» видны (правая панель показана и раздел раскрыт)
function updatePhases(cd, rows) {
  const i = ui.pvCyl, s = strokeOf(phaseOf(i)), deg = Math.round(cd);
  if (ph.cyl !== i) buildBand(i);
  if (ph.bs !== s) { mark(ph.band, s); ph.bs = s; }
  setText(el.angleSub, `цикл ${deg}°`);
  setText(el.angleStroke, `Ц${i + 1} — ${STROKES[s].name.toLowerCase()}`);
  const vt = `цикл ${deg}°, цилиндр ${i + 1}: ${STROKES[s].name.toLowerCase()}`;
  if (el.angleSlider.getAttribute('aria-valuetext') !== vt) el.angleSlider.setAttribute('aria-valuetext', vt);
  if (!rows) return;
  el.phases.style.setProperty('--x', pctOf(cd));
  for (let c = 0; c < 4; c++) {
    const sc = strokeOf(phaseOf(c));
    if (ph.s[c] === sc) continue;
    mark(ph.segs[c], sc); setText(ph.now[c], STROKES[sc].short); ph.s[c] = sc;
  }
}

export { initPhases, updatePhases };
