/* Раскладка панелей (M-05b; П-3, П-5, П-15 в 14_M05): режим по ширине окна, видимость панелей, «чистая сцена»,
 * сворачиваемые разделы.
 * Режимы: десктоп ≥1100 px, планшет 760–1099 px, телефон <760 px (временная раскладка до M-05c). Те же границы
 * у @media в styles/app.css. Боковые панели #hud («Разборка и детали») и #cycle («Работа двигателя»): на десктопе
 * открыты обе, на планшете и телефоне это шторки — открыта одна или ни одной. Лента #timeline видна всегда.
 * «Чистая сцена» (H, кнопка «Скрыть панели») прячет боковые панели и ленту; повторное H возвращает их как были.
 * Скрытая панель получает класс hid и inert. Выбор детали показывает правую панель (revealPanel): там карточка.
 * Разделы .sec[data-sec] сворачиваются по заголовку, состояние хранится в localStorage (ключ opus.engine.sections).
 * Высота ленты передаётся в CSS как --tl-h: над лентой стоят шторки планшета и уведомление.
 * Свободная область кадра (П-4) — freeArea(): между верхней панелью, видимыми боковыми панелями и лентой; после
 * каждого изменения раскладки вызывается обработчик onFreeArea(fn) — fn(animate): плавно при показе и скрытии панелей,
 * сразу при изменении размера окна.
 */
import { el } from './state.js';
import { setupCharts } from './charts/canvas.js';
import { freeRect } from './free-area.js';

const BREAK = { desktop: 1100, tablet: 760 };
const SIDES_AT_START = { desktop: ['hud', 'cycle'], tablet: ['hud'], phone: [] };
const SECTIONS_KEY = 'opus.engine.sections';
const lay = { mode: '', open: new Set(), clean: false, sec: {}, free: null, onFree: null };

const layoutMode = w => w >= BREAK.desktop ? 'desktop' : w >= BREAK.tablet ? 'tablet' : 'phone';
const panelShown = id => !lay.clean && (id === 'timeline' || lay.open.has(id));
function measureFree() {
  const shown = id => panelShown(id) ? el[id] : null, L = shown('hud'), R = shown('cycle'), T = shown('timeline');
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 12;
  lay.free = freeRect(innerWidth, innerHeight, { top: el.appbar.offsetTop + el.appbar.offsetHeight, gap,
    left: L ? L.offsetLeft + L.offsetWidth : null, right: R ? R.offsetLeft : null, bottom: T ? T.offsetTop : null });
}
const freeArea = () => lay.free || { l: 0, t: 0, r: innerWidth, b: innerHeight };
const onFreeArea = fn => { lay.onFree = fn; };
function applyLayout(animate = true) {
  for (const id of ['hud', 'cycle', 'timeline']) {
    const on = panelShown(id);
    el[id].classList.toggle('hid', !on);
    el[id].inert = !on;
  }
  el.drawerLeft.setAttribute('aria-pressed', panelShown('hud'));
  el.drawerRight.setAttribute('aria-pressed', panelShown('cycle'));
  const label = lay.clean ? 'Показать панели' : 'Скрыть панели';
  el.btnPanels.setAttribute('aria-pressed', lay.clean);
  el.btnPanels.setAttribute('aria-label', label);
  el.btnPanels.title = label + ' · H';
  const root = document.documentElement;
  root.classList.toggle('clean', lay.clean);
  root.dataset.layout = lay.mode;
  root.style.setProperty('--tl-h', el.timeline.offsetHeight + 'px');
  measureFree();
  if (lay.onFree) lay.onFree(animate);
}
function fitLayout() {
  const mode = layoutMode(innerWidth);
  if (mode !== lay.mode) { lay.mode = mode; lay.open = new Set(SIDES_AT_START[mode]); }
  applyLayout(false);
}
function togglePanels(force) {
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
function revealPanel(id) { if (!panelShown(id)) showSide(id, true); }

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

export { layoutMode, panelShown, freeArea, onFreeArea, fitLayout, togglePanels, toggleDrawer, revealPanel, sectionOpen, setSection, initSections };
