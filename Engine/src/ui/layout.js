/* Раскладка панелей (M-05b; П-3, П-5, П-15 в 14_M05): режим по ширине окна, видимость панелей, «чистая сцена»,
 * сворачиваемые разделы.
 * Режимы: десктоп ≥1100 px, планшет 760–1099 px, телефон <760 px (с M-05c — шторка, см. ниже). Те же границы
 * у @media в styles/app.css. Боковые панели #hud («Разборка и детали») и #cycle («Работа двигателя»): на десктопе
 * открыты обе, на планшете и телефоне это шторки — открыта одна или ни одной. Лента #timeline видна всегда.
 * «Чистая сцена» (H, кнопка «Скрыть панели») прячет боковые панели и ленту; повторное H возвращает их как были.
 * Скрытая панель получает класс hid и inert. Выбор детали показывает правую панель (revealPanel): там карточка.
 * Разделы .sec[data-sec] сворачиваются по заголовку, состояние хранится в localStorage (ключ opus.engine.sections).
 * Высота ленты передаётся в CSS как --tl-h: над лентой стоят шторки планшета и уведомление.
 * Свободная область кадра (П-4) — freeArea(): между верхней панелью, видимыми боковыми панелями и лентой; после
 * каждого изменения раскладки вызывается обработчик onFreeArea(fn) — fn(animate): плавно при показе и скрытии панелей,
 * сразу при изменении размера окна.
 * M-05d: подписи кнопки «Скрыть панели» — из ui/strings.ru.js. Если панель скрывается, когда в ней фокус с клавиатуры,
 * фокус переходит на кнопку, которой панель вернуть (ui/focus.js). Свободная область передаётся в CSS как --free-l,
 * --free-t, --free-r, --free-b: по ней рисуется рамка фокуса сцены.
 * M-05c (П-6, П-7): телефон. Режим зависит и от высоты окна: phone — ширина <760 px, landscape — высота <LANDSCAPE_H
 * при ширине <1100 px (телефон в альбомной ориентации). В обоих режимах (sheetMode) боковые панели и лента скрыты,
 * их элементы переносятся в шторку (ui/sheet.js): снизу в портрете, справа в альбоме. Свободная область — между
 * верхней панелью (в альбоме — плашкой) и шторкой; --tl-h — высота шторки в портрете (над ней стоит уведомление).
 * H сворачивает шторку до полосы (в альбоме — скрывает); выбор детали открывает вкладку «Детали»;
 * panelShown('cycle') и panelShown('hud') отвечают, видна ли вкладка «Работа» и «Детали».
 */
import { el } from './state.js';
import { setupCharts } from './charts/canvas.js';
import { freeRect } from './free-area.js';
import { S } from './strings.ru.js';
import { moveFocusOut, refocus } from './focus.js';
import { onSheet, paneShown, sheetBox, sheetEnter, sheetLeave, revealTab, toggleSheet } from './sheet.js';

const BREAK = { desktop: 1100, tablet: 760 };
const LANDSCAPE_H = 500;                    // ниже — телефон в альбомной ориентации (при ширине < BREAK.desktop)
const SIDES_AT_START = { desktop: ['hud', 'cycle'], tablet: ['hud'], phone: [], landscape: [] };
const SECTIONS_KEY = 'opus.engine.sections';
const lay = { mode: '', open: new Set(), clean: false, sec: {}, free: null, onFree: null, quiet: false };

const layoutMode = (w, h = Infinity) => w >= BREAK.desktop ? 'desktop' : h < LANDSCAPE_H ? 'landscape' : w >= BREAK.tablet ? 'tablet' : 'phone';
const sheetMode = () => lay.mode === 'phone' || lay.mode === 'landscape';
const sideShown = id => !sheetMode() && !lay.clean && (id === 'timeline' || lay.open.has(id));
// видна ли панель: в режиме шторки — её вкладка («Работа» вместо правой панели, «Детали» вместо левой)
const panelShown = id => sheetMode() ? paneShown(id === 'hud' ? 'parts' : 'work') : sideShown(id);
function measureFree() {
  const shown = id => sideShown(id) ? el[id] : null, L = shown('hud'), R = shown('cycle'), T = shown('timeline');
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 12;
  const sb = sheetBox();
  lay.free = freeRect(innerWidth, innerHeight, { top: el.appbar.offsetTop + el.appbar.offsetHeight, gap,
    left: L ? L.offsetLeft + L.offsetWidth : null, right: R ? R.offsetLeft : sb.left,
    bottom: T ? T.offsetTop : sb.h ? innerHeight - sb.h : null });
}
const freeArea = () => lay.free || { l: 0, t: 0, r: innerWidth, b: innerHeight };
const onFreeArea = fn => { lay.onFree = fn; };
function applyLayout(animate = true) {
  for (const id of ['hud', 'cycle', 'timeline']) {
    const on = sideShown(id);
    if (!on) moveFocusOut(el[id], sheetMode() ? el.canvas : lay.clean || lay.mode === 'desktop' ? el.btnPanels : id === 'hud' ? el.drawerLeft : el.drawerRight);
    el[id].classList.toggle('hid', !on);
    el[id].inert = !on;
  }
  el.drawerLeft.setAttribute('aria-pressed', sideShown('hud'));
  el.drawerRight.setAttribute('aria-pressed', sideShown('cycle'));
  const label = lay.clean ? S.showPanels : S.hidePanels;
  el.btnPanels.setAttribute('aria-pressed', lay.clean);
  el.btnPanels.setAttribute('aria-label', label);
  el.btnPanels.title = label + ' · H';
  const root = document.documentElement;
  root.classList.toggle('clean', lay.clean && !sheetMode());
  root.dataset.layout = lay.mode;
  root.style.setProperty('--tl-h', (sheetMode() ? sheetBox().h : el.timeline.offsetHeight) + 'px');
  measureFree();
  for (const k of ['l', 't', 'r', 'b']) root.style.setProperty('--free-' + k, lay.free[k] + 'px');
  if (lay.onFree) lay.onFree(animate);
}
function fitLayout() {
  const mode = layoutMode(innerWidth, innerHeight), a = document.activeElement;
  if (mode !== lay.mode) { lay.mode = mode; lay.open = new Set(SIDES_AT_START[mode]); }
  lay.quiet = true;                         // раскладку пересчитает applyLayout(false) ниже
  if (sheetMode()) sheetEnter(mode === 'landscape'); else sheetLeave();
  lay.quiet = false;
  applyLayout(false);
  refocus(a);                               // M-05c: элемент вернулся из шторки на место, панели уже показаны
}
function togglePanels(force) {
  if (sheetMode()) { toggleSheet(); return; }
  lay.clean = force !== undefined ? !!force : !lay.clean;
  applyLayout();
}
function showSide(id, on) {
  if (on) {
    if (lay.mode !== 'desktop') lay.open.clear();
    lay.open.add(id);
    lay.clean = false;
  } else lay.open.delete(id);
  applyLayout();
}
function toggleDrawer(id) { showSide(id, !panelShown(id)); }
// карточка детали: правая панель, в режиме шторки — вкладка «Детали»
function revealPanel(id) { if (sheetMode()) revealTab('parts'); else if (!panelShown(id)) showSide(id, true); }
onSheet(() => { if (!lay.quiet) applyLayout(); });

const sectionOpen = key => lay.sec[key] !== false;
function paintSection(key) {
  const btn = document.querySelector(`.sec[data-sec="${key}"] .sec-h`);
  btn.setAttribute('aria-expanded', sectionOpen(key));
  document.getElementById(btn.getAttribute('aria-controls')).hidden = !sectionOpen(key);
}
function setSection(key, open) {
  if (sectionOpen(key) === open) return;
  lay.sec[key] = open;
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(lay.sec)); } catch (e) { /* хранилище недоступно — состояние живёт до перезагрузки */ }
  paintSection(key);
  if (open) setupCharts();                  // canvas в свёрнутом разделе не знал своей ширины
}
function initSections() {
  try { const v = JSON.parse(localStorage.getItem(SECTIONS_KEY)); lay.sec = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { lay.sec = {}; }
  document.querySelectorAll('.sec[data-sec]').forEach(s => {
    const key = s.dataset.sec;
    s.querySelector('.sec-h').addEventListener('click', () => setSection(key, !sectionOpen(key)));
    paintSection(key);
  });
}

export { LANDSCAPE_H, layoutMode, sheetMode, panelShown, freeArea, onFreeArea, fitLayout, togglePanels, toggleDrawer, revealPanel, sectionOpen, setSection, initSections };
