/* Ввод: initUI() — элементы страницы и обработчики кнопок, ползунков, указателя и колёсика; выбор цилиндра setPvCyl(),
 * звук toggleSound(), клавиатура onKey(), изменение размера окна onResize().
 * M-02c: конец раздела 10 Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * life остаётся в main.js (M-03): main.js передаёт его через setInputLifecycle() при загрузке, до вызова initUI();
 * слушатели window и document снимаются в dispose().
 * M-05b: новая разметка (верхняя панель, боковые панели, лента времени): меню «Камера» и справка — ui/menus.js,
 * раскладка панелей и сворачиваемые разделы — ui/layout.js. Esc закрывает по порядку: меню → справка → изоляция →
 * выбор; пока открыта справка, другие клавиши не действуют, кроме ? и Shift+/ (закрыть). Строки «Фаз» вместо диаграммы
 * на canvas — ui/phases.js: нажатие на строку выбирает цилиндр для p–V. Центр кадра камеры следует за свободной
 * областью между панелями (ui/layout.js → ui/camera.js, П-4), в том числе при изменении размера окна.
 * M-05d (§7 в 14_M05): фокус снимается только после мыши и касания (ui/focus.js). Space и Enter на кнопке, ползунке,
 * радиокнопке или пункте меню действуют на этот элемент и не запускают двигатель; в остальных случаях Space — запуск
 * и пауза, как раньше. Сцена с клавиатуры: когда холст получил фокус клавиатурой (Tab; класс kbd, рамка по свободной
 * области), стрелки вращают камеру, Shift+стрелки сдвигают, PgUp и PgDn приближают и отдаляют (ui/camera.js); без
 * такого фокуса ← и → переключают шаги, как раньше. Сегмент «Вид» — радиогруппа: стрелки выбирают соседний вид.
 * Закрытая с клавиатуры карточка возвращает фокус на фишку детали (или на сцену), снятая изоляция — на сцену.
 * M-05c: шторка телефона — ui/sheet.js; во вкладке «Вид» — кнопки камеры #camSeg и «Сбросить вид». На телефоне после
 * ползунка разборки двигатель вписывается в свободную область над шторкой, если вышел за неё.
 */
import { DEG } from '../config/engine-spec.js';
import { audio } from '../audio/engine-audio.js';
import { $ } from '../render/world.js';
import { pixelRatio, renderer, camera, controls } from '../render/scene.js';
import { nodesList } from '../render/parts/nodes.js';
import { sim } from '../render/kinematics.js';
import { inPts, exPts } from '../render/effects/strokes.js';
import { ui, el } from './state.js';
import { meanProgress, boundsWith } from './explode.js';
import { exitStepMode, animateExplode, nextStep, prevStep, updateStepUI } from './steps.js';
import { frameBox, fitIfNeeded, cameraPreset, resetView, applyViewShift, focusOn, orbitBy, panBy, zoomBy } from './camera.js';
import { setView, cycleView, setCut } from './view.js';
import { pick, select, isolate, setHover } from './selection.js';
import { updateLive } from './info.js';
import { setupCharts } from './charts/canvas.js';
import { initPhases } from './phases.js';
import { buildLabels } from './labels.js';
import { touch, updateSpeedUI, setRunning, toggleRun, nudgeCrank, toast, setToggle, screenshot } from './controls.js';
import { fitLayout, onFreeArea, togglePanels, toggleDrawer, initSections, panelShown, sheetMode } from './layout.js';
import { initSheet } from './sheet.js';
import { menuOpen, setMenu, toggleMenu, initMenu, openHelp, closeHelp, toggleHelp, onHelpClosed } from './menus.js';
import { trackInput, viaKeyboard, blurAfterPointer, moveFocusOut } from './focus.js';
import { S, toastText } from './strings.ru.js';

let life;
const setInputLifecycle = ctl => { life = ctl; };

function initUI() {
  ['appbar', 'explodeSlider', 'explodeVal', 'explodeHdr', 'btnAssemble', 'btnExplode', 'stepDots', 'stepCount', 'stepTitle', 'stepNote', 'btnPrev', 'btnNext',
   'cutRow', 'cutSlider', 'cutVal', 'btnCam', 'camMenu', 'btnReset', 'btnLabels', 'btnRotate', 'btnSound', 'btnShot', 'btnPanels',
   'drawerLeft', 'drawerRight', 'partChips', 'partCount', 'hud', 'cycle', 'timeline', 'fps', 'btnRun', 'btnSlow', 'speedSlider', 'speedVal',
   'angleSlider', 'angleVal', 'angleSub', 'angleStroke', 'btnDegBack', 'btnDegFwd', 'phases', 'tlBands', 'tlTicks', 'pv', 'pvTitle', 'pvVal',
   'infocard', 'infoClose', 'infoTag', 'infoTitle', 'infoDesc', 'infoSpecs', 'infoLive', 'btnFocus', 'btnIsolate',
   'isoBar', 'isoName', 'btnUnIso', 'btnCamReset', 'toast', 'flash', 'help', 'helpClose', 'helpLink', 'helpLink2', 'labels', 'tooltip'].forEach(id => { el[id] = $(id); });
  el.canvas = renderer.domElement;
  el.fireChips = Array.from(document.querySelectorAll('.fire .c'));
  el.fireHot = el.fireChips.concat(Array.from(document.querySelectorAll('#fireMini [data-c]')));   // M-05c: и мини-фишки шторки

  // M-05d: после мыши и касания кнопки не держат фокус (Space не нажимает их повторно); фокус с клавиатуры остаётся
  trackInput(life);
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); }, { signal: life.signal });

  el.explodeSlider.addEventListener('input', () => {
    exitStepMode();
    if (ui.explodeTw) { ui.explodeTw.kill(); ui.explodeTw = null; }
    ui.explode = el.explodeSlider.value / 100;
  });
  el.explodeSlider.addEventListener('change', () => {
    blurAfterPointer(el.explodeSlider);
    if (sheetMode()) fitIfNeeded(boundsWith(ui.explode));   // M-05c: на телефоне разобранный двигатель не уходит за край
  });
  el.btnAssemble.addEventListener('click', () => { animateExplode(0); frameBox(boundsWith(0), 1.2, 0.15); });
  el.btnExplode.addEventListener('click', () => { animateExplode(1); frameBox(boundsWith(1), 1.35, 0.25); });
  el.btnPrev.addEventListener('click', prevStep);
  el.btnNext.addEventListener('click', nextStep);

  document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
  $('viewSeg').addEventListener('keydown', viewKey);
  el.cutSlider.addEventListener('input', () => setCut(+el.cutSlider.value));
  el.cutSlider.addEventListener('change', () => blurAfterPointer(el.cutSlider));
  setCut(+el.cutSlider.value);
  el.btnCam.addEventListener('click', toggleMenu);
  initMenu(life.signal);
  el.camMenu.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => { setMenu(false); cameraPreset(b.dataset.cam); }));
  el.btnReset.addEventListener('click', () => { setMenu(false); resetView(); });
  document.querySelectorAll('#camSeg [data-preset]').forEach(b => b.addEventListener('click', () => cameraPreset(b.dataset.preset)));
  el.btnCamReset.addEventListener('click', resetView);
  document.addEventListener('pointerdown', e => { if (menuOpen() && !e.target.closest('.menu-wrap')) setMenu(false); }, { signal: life.signal });
  el.btnLabels.addEventListener('click', () => { ui.labels = !ui.labels; setToggle(el.btnLabels, ui.labels); });
  el.btnRotate.addEventListener('click', () => { ui.autoRotate = !ui.autoRotate; setToggle(el.btnRotate, ui.autoRotate); ui.lastInteract = 0; });
  el.btnSound.addEventListener('click', toggleSound);
  el.btnShot.addEventListener('click', screenshot);

  // chips
  nodesList.forEach(n => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.type = 'button';
    c.setAttribute('aria-pressed', 'false');
    c.textContent = n.userData.info.short;
    c.title = n.userData.info.name;
    c.addEventListener('click', () => select(ui.selected === n ? null : n));
    c.addEventListener('dblclick', () => isolate(n));
    el.partChips.appendChild(c);
    (el.chips = el.chips || {})[n.userData.key] = c;
  });
  el.partCount.textContent = S.nodeCount(nodesList.length);

  // panels, help
  el.drawerLeft.addEventListener('click', () => toggleDrawer('hud'));
  el.drawerRight.addEventListener('click', () => toggleDrawer('cycle'));
  el.btnPanels.addEventListener('click', () => togglePanels());
  initSections();
  initSheet(life);
  onFreeArea(applyViewShift);               // П-4: центр кадра — в свободной области между панелями
  fitLayout();
  el.helpLink.addEventListener('click', openHelp);
  el.helpLink2.addEventListener('click', openHelp);
  el.helpClose.addEventListener('click', closeHelp);
  el.help.addEventListener('click', e => { if (e.target === el.help && outside(el.help, e)) closeHelp(); });   // щелчок по фону
  el.help.addEventListener('close', onHelpClosed);

  // engine controls
  el.btnRun.addEventListener('click', toggleRun);
  el.btnSlow.addEventListener('click', () => { sim.slow = !sim.slow; setToggle(el.btnSlow, sim.slow); updateSpeedUI(); });
  el.speedSlider.addEventListener('input', updateSpeedUI);
  el.speedSlider.addEventListener('change', () => blurAfterPointer(el.speedSlider));
  updateSpeedUI();
  const startScrub = () => { if (ui.scrubbing) return; ui.scrubbing = true; ui.wasRunning = sim.running; if (sim.running) setRunning(false); };
  const endScrub = () => { if (!ui.scrubbing) return; ui.scrubbing = false; if (ui.wasRunning) setRunning(true); blurAfterPointer(el.angleSlider); };
  el.angleSlider.addEventListener('pointerdown', startScrub);
  el.angleSlider.addEventListener('input', () => {
    if (!ui.scrubbing) { startScrub(); ui.scrubbing = 'key'; }
    const base = Math.floor(sim.theta / DEG / 720) * 720;
    sim.theta = (base + +el.angleSlider.value) * DEG;
  });
  el.angleSlider.addEventListener('change', endScrub);
  window.addEventListener('pointerup', endScrub, { signal: life.signal });
  const holdRepeat = (btn, sign) => {
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => {
      const step = (e.shiftKey ? 1 : 5) * sign;
      nudgeCrank(step);
      stop();
      t1 = setTimeout(() => { t2 = setInterval(() => nudgeCrank(step), 45); }, 320);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
    btn.addEventListener('click', e => { if (e.detail === 0) nudgeCrank((e.shiftKey ? 1 : 5) * sign); });   // M-05d: Enter и Space
  };
  holdRepeat(el.btnDegBack, -1);
  holdRepeat(el.btnDegFwd, 1);
  initPhases();
  el.phases.addEventListener('click', e => { const r = e.target.closest('.ph-row'); if (r) setPvCyl(+r.dataset.c); });
  el.fireChips.forEach(c => c.addEventListener('click', () => setPvCyl(+c.dataset.c)));

  // info card
  el.infoClose.addEventListener('click', closeCard);
  el.btnFocus.addEventListener('click', () => ui.selected && focusOn(ui.selected));
  el.btnIsolate.addEventListener('click', () => isolate(ui.isolated === ui.selected ? null : ui.selected));
  el.btnUnIso.addEventListener('click', unIsolate);

  // pointer: hover, click vs drag, double-click isolate
  const cv = el.canvas;
  const setPtr = e => {
    const r = cv.getBoundingClientRect();
    ui.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ui.pointerPx.x = e.clientX; ui.pointerPx.y = e.clientY;
  };
  cv.addEventListener('pointermove', e => {
    setPtr(e);
    el.tooltip.style.left = e.clientX + 'px'; el.tooltip.style.top = e.clientY + 'px';
    if (ui.down && Math.hypot(e.clientX - ui.down.x, e.clientY - ui.down.y) > 5) ui.dragging = true;
    ui.needHover = !ui.dragging;
    if (ui.dragging) setHover(null);
  });
  cv.addEventListener('pointerleave', () => { ui.needHover = false; setHover(null); });
  cv.addEventListener('focus', () => setSceneKeys(viaKeyboard()));
  cv.addEventListener('blur', () => setSceneKeys(false));
  cv.addEventListener('pointerdown', e => {
    ui.down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    ui.dragging = false;
    ui.lastInteract = performance.now();
    cv.focus({ preventScroll: true });
    setSceneKeys(false);                    // после focus(): trackInput узнает об указателе позже, на document
  });
  cv.addEventListener('pointerup', e => {
    const d = ui.down; ui.down = null;
    if (!d || d.button !== 0) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 5 || performance.now() - d.t > 600) { ui.dragging = false; return; }
    setPtr(e);
    const n = pick();
    if (n !== ui.selected || !n) select(n);
  });
  cv.addEventListener('dblclick', e => {
    setPtr(e);
    const n = pick();
    if (n) isolate(n); else if (ui.isolated) isolate(null);
  });
  controls.addEventListener('start', () => { if (ui.camTw) { ui.camTw.kill(); ui.camTw = null; } ui.lastInteract = performance.now(); });
  cv.addEventListener('wheel', () => { if (ui.camTw) { ui.camTw.kill(); ui.camTw = null; } ui.lastInteract = performance.now(); }, { passive: true });

  window.addEventListener('keydown', onKey, { signal: life.signal });
  window.addEventListener('resize', onResize, { signal: life.signal });
  updateStepUI();
  buildLabels();
  setupCharts();
  setPvCyl(ui.pvCyl);
}
// сцена получила фокус с клавиатуры: стрелки и PgUp/PgDn управляют камерой
let sceneKeys = false;
function setSceneKeys(on) { sceneKeys = on; el.canvas.classList.toggle('kbd', on); }
function sceneKey(e) {
  const k = e.key;
  if (k === 'PageUp' || k === 'PageDown') zoomBy(k === 'PageUp' ? 1 : -1);
  else {
    const dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, dy = k === 'ArrowUp' ? 1 : k === 'ArrowDown' ? -1 : 0;
    if (e.shiftKey) panBy(dx, dy); else orbitBy(dx, dy);
  }
  e.preventDefault();
}
// радиогруппа «Вид»: стрелки и Home/End выбирают вид и переносят на него фокус
function viewKey(e) {
  const list = Array.from(document.querySelectorAll('#viewSeg button')), i = list.findIndex(b => b.dataset.mode === ui.view), k = e.key;
  const to = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % 3 : k === 'ArrowLeft' || k === 'ArrowUp' ? (i + 2) % 3
    : k === 'Home' ? 0 : k === 'End' ? 2 : -1;
  if (to < 0 || e.ctrlKey || e.metaKey || e.altKey) return;
  setView(list[to].dataset.mode);
  list[to].focus();
  e.preventDefault();
}
function closeCard() {
  const n = ui.selected;
  moveFocusOut(el.infocard, n && panelShown('hud') ? el.chips[n.userData.key] : el.canvas);
  select(null, false);
}
function unIsolate() {
  moveFocusOut(el.isoBar, el.canvas);
  isolate(null);
}
// Space и Enter на элементе управления действуют на него (нативное нажатие), а не на двигатель
const CONTROL = 'button, input, a[href], [role=radio], [role=tab], [role^=menuitem]';
const onControl = t => !!(t && t !== el.canvas && t.matches && t.matches(CONTROL));
function outside(box, e) {
  const r = box.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
function setPvCyl(i) {
  ui.pvCyl = i;
  el.pvTitle.textContent = S.pvTitle(i + 1);
  el.pv.setAttribute('aria-label', S.pvLabel(i + 1));
  el.fireChips.forEach(c => c.setAttribute('aria-pressed', +c.dataset.c === i));
  el.phaseRows.forEach(r => r.setAttribute('aria-pressed', +r.dataset.c === i));
  updateLive(true);
}
function toggleSound() {
  const want = !audio.on;
  if (!audio.setOn(want)) { toast(toastText('noAudio')); return; }
  setToggle(el.btnSound, want);
  if (want) toast(sim.running ? toastText('soundRun') : toastText('soundIdle', touch()));
}
function onKey(e) {
  if (e.defaultPrevented) return;                          // M-05d: клавишу уже обработали меню или радиогруппа
  const t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' && /^(Arrow|Page|Home|End)/.test(e.key)) return;   // let a focused slider use its keys
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  ui.lastInteract = performance.now();
  if (k === 'Escape') {
    if (menuOpen()) setMenu(false);
    else if (el.help.open) closeHelp();
    else if (ui.isolated) unIsolate();
    else if (ui.selected) closeCard();
    return;
  }
  if (el.help.open) { if (k === '?' || (e.code === 'Slash' && e.shiftKey)) closeHelp(); return; }
  if ((k === ' ' || k === 'Enter') && onControl(t)) return;   // M-05d: нажатие получает сам элемент
  if (t === el.canvas && sceneKeys && /^(Arrow|Page(Up|Down)$)/.test(k)) { sceneKey(e); return; }
  if (k === ' ') { toggleRun(); e.preventDefault(); }
  else if (k === 'ArrowRight') { nextStep(); e.preventDefault(); }
  else if (k === 'ArrowLeft') { prevStep(); e.preventDefault(); }
  else if (k === ',' || k === '<' || k === 'б' || k === 'Б') nudgeCrank(e.shiftKey ? -1 : -5);
  else if (k === '.' || k === '>' || k === 'ю' || k === 'Ю') nudgeCrank(e.shiftKey ? 1 : 5);
  else if (k === '+' || k === '=') { el.speedSlider.value = Math.min(100, +el.speedSlider.value + 5); updateSpeedUI(); }
  else if (k === '-' || k === '_') { el.speedSlider.value = Math.max(0, +el.speedSlider.value - 5); updateSpeedUI(); }
  else if (k === '?') toggleHelp();
  else if (/^[1-4]$/.test(k)) cameraPreset(['front', 'side', 'top', 'iso'][+k - 1]);
  else {
    const code = e.code;   // layout-independent (works with the Russian layout too)
    if (code === 'KeyR') resetView();
    else if (code === 'KeyE') { if (meanProgress() > 0.5) el.btnAssemble.click(); else el.btnExplode.click(); }
    else if (code === 'KeyX') cycleView();
    else if (code === 'KeyL') el.btnLabels.click();
    else if (code === 'KeyA') el.btnRotate.click();
    else if (code === 'KeyM') toggleSound();
    else if (code === 'KeyS') el.btnSlow.click();
    else if (code === 'KeyP') screenshot();
    else if (code === 'KeyH') togglePanels();
    else if (code === 'KeyF') { if (ui.selected) focusOn(ui.selected); }
    else if (code === 'KeyI') { if (ui.selected) isolate(ui.isolated === ui.selected ? null : ui.selected); }
    else if (code === 'Slash' && e.shiftKey) toggleHelp();
  }
}
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  [inPts, exPts].forEach(P => { P.points.material.uniforms.uScale.value = innerHeight * pixelRatio * 0.5; });
  fitLayout();
  setupCharts();
}

export { initUI, onResize, setInputLifecycle };
