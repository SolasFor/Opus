/* Шторка телефона (M-05c; П-6, П-7 и §5 в 14_M05).
 * Телефон в портретной ориентации (ширина <760 px): нижняя шторка с тремя высотами — свёрнутая (SHEET_MIN = 124 px:
 * ручка, запуск и пауза, угол цикла, мини-фишки порядка работы 1–3–4–2 и вкладки), половина окна (SHEET_HALF)
 * и почти всё окно (SHEET_FULL). Телефон в альбомной ориентации (высота <500 px): шторка справа шириной min(40vw, 380px), открыта или
 * скрыта — кнопка «Панель управления» на плашке слева вверху и клавиша H.
 * Вкладки «Работа · Разборка · Вид · Детали» (tablist, стрелки, Home и End): элементы боковых панелей, ленты и верхней
 * панели переносятся в шторку, а не копируются (таблица MOVES) — обработчики, id и состояние остаются прежними.
 * На прежнем месте остаётся якорь-комментарий: при выходе из режима шторки всё возвращается туда же.
 * Жесты: ручку и пустое место полосы можно тянуть. Отпускание выбирает ближайшую высоту, быстрый взмах (скорость за
 * последние FLING_MS мс выше FLING_V px/мс) — следующую в его сторону. Касание ручки без сдвига (меньше TAP_PX), Enter
 * и Space на ней — следующая высота по кругу; ↑ и ↓ на ручке — выше и ниже. Вкладка в свёрнутой шторке открывает её
 * наполовину. Выбор детали открывает «Детали» не меньше чем наполовину (revealTab).
 * Высота передаётся в CSS как --sheet-h (вместе с безопасной зоной снизу); после каждого изменения вызывается
 * обработчик onSheet(fn): layout.js пересчитывает свободную область кадра. Высоты, выбор высоты, вкладки и таблица
 * переноса — в ui/sheet-model.js (без DOM, проверяет tests/sheet.test.js).
 */
import { el } from './state.js';
import { setupCharts } from './charts/canvas.js';
import { moveFocusOut, refocus } from './focus.js';
import { S } from './strings.ru.js';
import { FLING_MS, TAP_PX, TABS, MOVES, stopHeight, snapStop, nextStop } from './sheet-model.js';

const sht = { on: false, side: false, stop: 'min', back: 'half', open: true, tab: 'work', anchors: [], drag: null, dragged: false, h: 0, onChange: null };
const onSheet = fn => { sht.onChange = fn; };
// вкладка key видна и не свёрнута
const paneShown = key => sht.on && sht.tab === key && (sht.side ? sht.open : sht.stop !== 'min');
// сколько шторка занимает снизу (портрет) и слева от правого края (альбом), px
const sheetBox = () => ({ h: sht.on && !sht.side ? sht.h : 0, left: sht.on && sht.side && sht.open ? el.sheet.offsetLeft : null });
const safeBottom = () => parseFloat(getComputedStyle(el.sheet).paddingBottom) || 0;

// перенос узлов: фокус теряется, когда элемент вынимают из документа, — sheetEnter() возвращает его сам, после
// sheetLeave() — fitLayout() (ui/layout.js), когда панели уже показаны
function sheetEnter(side) {
  sht.side = side;
  if (sht.on) { paintSheet(); return; }
  sht.on = true;
  const a = document.activeElement;
  for (const [sel, to] of MOVES) {
    const n = document.querySelector(sel), c = document.createComment('sheet: ' + sel);
    n.before(c);
    sht.anchors.push([c, n]);
    document.getElementById(to).appendChild(n);
  }
  el.sheet.hidden = false;
  // фокус был на перенесённом элементе вкладки: она открывается (не меньше чем наполовину), фокус остаётся на нём
  const pane = a && el.sheetBody.contains(a) ? a.closest('[role="tabpanel"]') : null;
  if (pane) { sht.tab = pane.id.slice(5); if (side) sht.open = true; else if (sht.stop === 'min') sht.stop = 'half'; }
  paintSheet();
  refocus(a);
}
function sheetLeave() {
  if (!sht.on) return;
  sht.on = false;
  for (const [c, n] of sht.anchors) c.replaceWith(n);
  sht.anchors = [];
  el.sheet.hidden = true;
  setupCharts();
}

function paintSheet() {
  if (!sht.on) return;
  const portrait = !sht.side, collapsed = portrait ? sht.stop === 'min' : !sht.open;
  if (collapsed) moveFocusOut(portrait ? el.sheetBody : el.sheet, portrait ? el.sheetHandle : el.sheetToggle);
  sht.h = portrait ? stopHeight(sht.stop, innerHeight, safeBottom()) : 0;
  el.sheet.classList.toggle('land', sht.side);         // не .side: так называются боковые панели
  el.sheet.classList.toggle('closed', sht.side && !sht.open);
  el.sheet.dataset.stop = portrait ? sht.stop : sht.open ? 'open' : 'closed';
  el.sheet.style.setProperty('--sheet-h', sht.h + 'px');
  el.sheet.inert = sht.side && !sht.open;
  el.sheetBody.inert = portrait && collapsed;
  el.sheetHandle.setAttribute('aria-expanded', sht.stop !== 'min');
  el.sheetHandle.setAttribute('aria-label', S.sheetHandle[sht.stop]);
  el.sheetToggle.setAttribute('aria-pressed', sht.side && sht.open);
  for (const key of TABS) {
    const t = document.getElementById('tab-' + key), on = key === sht.tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById('pane-' + key).hidden = !on;
  }
  setupCharts();                            // p–V знает свою ширину, только когда вкладка видна
  if (sht.onChange) sht.onChange();
}
function setStop(stop) {
  if (stop !== 'min') sht.back = stop;
  sht.stop = stop;
  paintSheet();
}
function setTab(key) {
  sht.tab = key;
  if (sht.side) sht.open = true;
  else if (sht.stop === 'min') sht.stop = 'half';
  paintSheet();
}
// показать вкладку (выбор детали): не меньше чем наполовину, сверху
function revealTab(key) {
  if (!sht.on) return;
  const wasShown = paneShown(key);
  sht.tab = key;
  if (sht.side) sht.open = true;
  else if (sht.stop === 'min') sht.stop = 'half';
  if (!wasShown) paintSheet(); else if (sht.onChange) sht.onChange();
  document.getElementById('pane-' + key).scrollTop = 0;
}
// H и кнопка «Панель управления»: альбом — открыть или скрыть; портрет — свернуть до полосы или вернуть прежнюю высоту
function toggleSheet() {
  if (sht.side) { sht.open = !sht.open; paintSheet(); }
  else setStop(sht.stop === 'min' ? sht.back : 'min');
}

function tabKey(e) {
  const i = TABS.indexOf(e.target.dataset.tab);
  if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault();
  const key = TABS[(j + TABS.length) % TABS.length];
  setTab(key);
  document.getElementById('tab-' + key).focus();
}
function handleKey(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  setStop(nextStop(sht.stop, e.key === 'ArrowUp' ? 1 : -1));
}
function dragStart(e) {
  sht.dragged = false;
  if (sht.side || e.button > 0) return;
  const b = e.target.closest('button');
  if (b && b !== el.sheetHandle) return;    // кнопки полосы нажимаются, а не тянут шторку
  sht.drag = { id: e.pointerId, y0: e.clientY, h0: sht.h, h: sht.h, pts: [[e.timeStamp, e.clientY]], moved: false };
}
function dragMove(e) {
  const d = sht.drag;
  if (!d || e.pointerId !== d.id) return;
  if (!d.moved && Math.abs(e.clientY - d.y0) < TAP_PX) return;
  d.moved = true;
  el.sheet.classList.add('dragging');
  const safe = safeBottom();
  d.h = Math.min(stopHeight('full', innerHeight, safe), Math.max(stopHeight('min', innerHeight, safe), d.h0 + d.y0 - e.clientY));
  el.sheet.style.setProperty('--sheet-h', d.h + 'px');
  d.pts.push([e.timeStamp, e.clientY]);
  while (d.pts.length > 2 && e.timeStamp - d.pts[0][0] > FLING_MS) d.pts.shift();
}
function dragEnd(e) {
  const d = sht.drag;
  if (!d || e.pointerId !== d.id) return;
  sht.drag = null;
  el.sheet.classList.remove('dragging');
  if (!d.moved) return;                     // касание — его обработает click
  sht.dragged = true;                       // click после перетаскивания касанием не считается
  const [t0, y0] = d.pts[0], v = e.type === 'pointercancel' ? 0 : (y0 - e.clientY) / Math.max(1, e.timeStamp - t0);
  setStop(snapStop(d.h, v, innerHeight, safeBottom()));
}
function initSheet(life) {
  for (const id of ['sheet', 'sheetHead', 'sheetHandle', 'sheetBody', 'sheetTabs', 'sheetToggle']) el[id] = document.getElementById(id);
  el.sheetTabs.addEventListener('click', e => { const t = e.target.closest('[role=tab]'); if (t) setTab(t.dataset.tab); });
  el.sheetTabs.addEventListener('keydown', tabKey);
  el.sheetHandle.addEventListener('click', () => { if (sht.dragged) { sht.dragged = false; return; } setStop(nextStop(sht.stop)); });
  el.sheetHandle.addEventListener('keydown', handleKey);
  el.sheetToggle.addEventListener('click', toggleSheet);
  el.sheetHead.addEventListener('pointerdown', dragStart);
  window.addEventListener('pointermove', dragMove, { signal: life.signal });
  window.addEventListener('pointerup', dragEnd, { signal: life.signal });
  window.addEventListener('pointercancel', dragEnd, { signal: life.signal });
}

export { onSheet, paneShown, sheetBox, sheetEnter, sheetLeave, revealTab, toggleSheet, initSheet };
