/* Ввод: initUI() — элементы страницы и обработчики кнопок, ползунков, указателя и колёсика; выбор цилиндра setPvCyl(),
 * звук toggleSound(), клавиатура onKey(), изменение размера окна onResize().
 * M-02c: конец раздела 10 Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * life остаётся в main.js (M-03): main.js передаёт его через setInputLifecycle() при загрузке, до вызова initUI();
 * слушатели window и document снимаются в dispose().
 * M-05b: новая разметка (верхняя панель, боковые панели, лента времени): меню «Камера» и справка — ui/menus.js,
 * раскладка панелей и сворачиваемые разделы — ui/layout.js. Esc закрывает по порядку: меню → справка → изоляция →
 * выбор; пока открыта справка, другие клавиши не действуют, кроме ? и Shift+/ (закрыть).
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
import { frameBox, cameraPreset, resetView, focusOn } from './camera.js';
import { setView, cycleView, setCut } from './view.js';
import { pick, select, isolate, setHover } from './selection.js';
import { updateLive } from './info.js';
import { setupCharts } from './charts/canvas.js';
import { TL } from './charts/timing.js';
import { buildLabels } from './labels.js';
import { updateSpeedUI, setRunning, toggleRun, nudgeCrank, toast, setToggle, screenshot } from './controls.js';
import { fitLayout, togglePanels, toggleDrawer, initSections } from './layout.js';
import { menuOpen, setMenu, toggleMenu, openHelp, closeHelp, toggleHelp, dropFocus } from './menus.js';

let life;
const setInputLifecycle = ctl => { life = ctl; };

function initUI() {
  ['explodeSlider', 'explodeVal', 'explodeHdr', 'btnAssemble', 'btnExplode', 'stepDots', 'stepCount', 'stepTitle', 'stepNote', 'btnPrev', 'btnNext',
   'cutRow', 'cutSlider', 'cutVal', 'btnCam', 'camMenu', 'btnReset', 'btnLabels', 'btnRotate', 'btnSound', 'btnShot', 'btnPanels',
   'drawerLeft', 'drawerRight', 'partChips', 'partCount', 'hud', 'cycle', 'timeline', 'fps', 'btnRun', 'btnSlow', 'speedSlider', 'speedVal',
   'angleSlider', 'angleVal', 'angleSub', 'btnDegBack', 'btnDegFwd', 'timing', 'pv', 'pvTitle', 'pvVal',
   'infocard', 'infoClose', 'infoTag', 'infoTitle', 'infoDesc', 'infoSpecs', 'infoLive', 'btnFocus', 'btnIsolate',
   'isoBar', 'isoName', 'btnUnIso', 'toast', 'flash', 'help', 'helpClose', 'helpLink', 'helpLink2', 'labels', 'tooltip'].forEach(id => { el[id] = $(id); });
  el.canvas = renderer.domElement;
  el.fireChips = Array.from(document.querySelectorAll('.fire .c'));

  // buttons never keep focus (so Space never double-triggers a focused button)
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); }, { signal: life.signal });

  el.explodeSlider.addEventListener('input', () => {
    exitStepMode();
    if (ui.explodeTw) { ui.explodeTw.kill(); ui.explodeTw = null; }
    ui.explode = el.explodeSlider.value / 100;
  });
  el.explodeSlider.addEventListener('change', () => el.explodeSlider.blur());
  el.btnAssemble.addEventListener('click', () => { animateExplode(0); frameBox(boundsWith(0), 1.2, 0.15); });
  el.btnExplode.addEventListener('click', () => { animateExplode(1); frameBox(boundsWith(1), 1.35, 0.25); });
  el.btnPrev.addEventListener('click', prevStep);
  el.btnNext.addEventListener('click', nextStep);

  document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
  el.cutSlider.addEventListener('input', () => setCut(+el.cutSlider.value));
  el.cutSlider.addEventListener('change', () => el.cutSlider.blur());
  setCut(+el.cutSlider.value);
  el.btnCam.addEventListener('click', toggleMenu);
  el.camMenu.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => { setMenu(false); cameraPreset(b.dataset.cam); }));
  el.btnReset.addEventListener('click', () => { setMenu(false); resetView(); });
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
  el.partCount.textContent = nodesList.length + ' узлов';

  // panels, help
  el.drawerLeft.addEventListener('click', () => toggleDrawer('hud'));
  el.drawerRight.addEventListener('click', () => toggleDrawer('cycle'));
  el.btnPanels.addEventListener('click', () => togglePanels());
  initSections();
  fitLayout();
  el.helpLink.addEventListener('click', openHelp);
  el.helpLink2.addEventListener('click', openHelp);
  el.helpClose.addEventListener('click', closeHelp);
  el.help.addEventListener('click', e => { if (e.target === el.help && outside(el.help, e)) closeHelp(); });   // щелчок по фону
  el.help.addEventListener('close', dropFocus);

  // engine controls
  el.btnRun.addEventListener('click', toggleRun);
  el.btnSlow.addEventListener('click', () => { sim.slow = !sim.slow; setToggle(el.btnSlow, sim.slow); updateSpeedUI(); });
  el.speedSlider.addEventListener('input', updateSpeedUI);
  el.speedSlider.addEventListener('change', () => el.speedSlider.blur());
  updateSpeedUI();
  const startScrub = () => { if (ui.scrubbing) return; ui.scrubbing = true; ui.wasRunning = sim.running; if (sim.running) setRunning(false); };
  const endScrub = () => { if (!ui.scrubbing) return; ui.scrubbing = false; if (ui.wasRunning) setRunning(true); el.angleSlider.blur(); };
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
  };
  holdRepeat(el.btnDegBack, -1);
  holdRepeat(el.btnDegFwd, 1);
  el.timing.addEventListener('click', e => {
    const r = el.timing.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top - TL.top) / TL.row);
    if (i >= 0 && i < 4) setPvCyl(i);
  });
  el.fireChips.forEach(c => c.addEventListener('click', () => setPvCyl(+c.dataset.c)));

  // info card
  el.infoClose.addEventListener('click', () => select(null, false));
  el.btnFocus.addEventListener('click', () => ui.selected && focusOn(ui.selected));
  el.btnIsolate.addEventListener('click', () => isolate(ui.isolated === ui.selected ? null : ui.selected));
  el.btnUnIso.addEventListener('click', () => isolate(null));

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
  cv.addEventListener('pointerdown', e => {
    ui.down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    ui.dragging = false;
    ui.lastInteract = performance.now();
    cv.focus({ preventScroll: true });
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
function outside(box, e) {
  const r = box.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
function setPvCyl(i) {
  ui.pvCyl = i;
  el.pvTitle.textContent = 'p–V · цилиндр ' + (i + 1);
  el.fireChips.forEach(c => c.setAttribute('aria-pressed', +c.dataset.c === i));
  updateLive(true);
}
function toggleSound() {
  const want = !audio.on;
  if (!audio.setOn(want)) { toast('Браузер не поддерживает WebAudio'); return; }
  setToggle(el.btnSound, want);
  if (want) toast(sim.running ? 'Звук включён: каждый «хлопок» — рабочий ход' : 'Звук включён — запустите двигатель (Space)');
}
function onKey(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' && /^Arrow/.test(e.key)) return;     // let a focused slider use the arrows
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  ui.lastInteract = performance.now();
  if (k === 'Escape') {
    if (menuOpen()) setMenu(false);
    else if (el.help.open) closeHelp();
    else if (ui.isolated) isolate(null);
    else if (ui.selected) select(null, false);
    return;
  }
  if (el.help.open) { if (k === '?' || (e.code === 'Slash' && e.shiftKey)) closeHelp(); return; }
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
