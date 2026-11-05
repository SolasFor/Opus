/* Engine — модульная версия (M-01b). Открывается только по HTTP (D-15): GitHub Pages или локальный сервер,
 * например `python3 -m http.server` в корне репозитория. Без сервера работает однофайловая Engine/Engine.html.
 * Основа — встроенный модуль Engine/Engine.html, перенесённый дословно. Шов модели: константы и функции модели
 * импортируются из ./config и ./sim (их тождество с копиями в Engine.html проверяют spec-sync.test.js
 * и legacy-parity.test.js), cycDeg и phaseOf — обёртки над cycleDeg и cylinderPhaseDeg с аргументом sim.theta.
 * С X-01 Engine.html заморожен (D-17): изменения вносятся только сюда, заморозку проверяет tests/legacy-freeze.test.js.
 * M-03: сообщения о сбоях запуска (экран загрузки в index.html), потеря и восстановление WebGL-контекста,
 * остановка цикла при повторяющейся ошибке кадра, engine.dispose().
 * M-02a: разделы 2, 3 и 9 (мини-tween, карточки деталей и шаги разборки, звук) перенесены дословно в src/anim/tween.js,
 * src/config/parts.js, src/config/steps.js и src/audio/engine-audio.js; дословность проверяет tests/split-sync.test.js.
 * M-02b: разделы 1 и 4–8 (константы сцены, сцена, материалы, детали, кинематика, эффекты тактов) перенесены дословно
 * в src/render/; дословность проверяет tests/split-sync.test.js. cycDeg и phaseOf теперь в src/render/kinematics.js.
 * M-02c: раздел 10 (интерфейс) перенесён дословно в src/ui/; дословность проверяет tests/split-sync.test.js. В main.js —
 * корень композиции: связка модулей, цикл рендера и адаптивное разрешение, потеря контекста и dispose(), запуск.
 * M-07a: кадр и снимок экрана рисует renderFrame() из src/render/post.js — с экранным затенением GTAO на уровне
 * качества «высокое» (src/render/quality.js) или прежним renderer.render(); адаптивное разрешение выключает AO,
 * если кадр медленный и при pixelRatio 1.
 * M-07c: уровень детализации «низкий» (lowDetail из src/render/quality.js) выбирается до buildEngine(); на нём нет AO.
 * M-06b: шаг адаптивного разрешения — adaptPR() из src/render/quality.js, с гистерезисом против качания уровней.
 * M-05d: индикатор fps — только с ?debug (П-13); уведомления — из src/ui/strings.ru.js; при prefers-reduced-motion
 * нет пролёта камеры при старте (src/ui/motion.js).
 */
/* ============================================================================
 * ЧЕТЫРЁХТАКТНЫЙ ДВИГАТЕЛЬ — интерактивная 3D-разборка (рядная «четвёрка», DOHC 16V)
 * Один файл · Three.js 0.160 (ES-модули с CDN через importmap) · всё процедурно.
 *
 *  1. Константы геометрии и фаз газораспределения (цикл 720°, порядок 1-3-4-2)
 *  2. Мини-движок анимаций (tween + easing) вместо GSAP
 *  3. Данные: карточки деталей, шаги разборки
 *  4. Сцена, свет, окружение (PMREM RoomEnvironment), пол
 *  5. Материалы (+ шейдер «сечения» для разреза)
 *  6. Процедурные детали: каждая — узел (THREE.Group) с merged-геометрией / InstancedMesh
 *  7. Кинематика: кривошипно-шатунный механизм, кулачки → клапаны, ремень ГРМ
 *  8. Эффекты тактов: свечение камер, искра, вспышка, частицы смеси и выхлопа
 *  9. Звук (WebAudio, синтез)
 * 10. Интерфейс: разборка, шаги, вид/разрез, камера, подписи, карточки, диаграммы
 * 11. Цикл рендера, адаптивное разрешение, запуск
 * ========================================================================== */
import { DEG } from './config/engine-spec.js';
import { clamp } from './sim/math.js';
import { pressureAt } from './sim/thermo.js';
import { tweens, updateTweens } from './anim/tween.js';
import { audio, setSpeedSource } from './audio/engine-audio.js';
import { BASE_RPM, CAM_HOME, TGT_HOME } from './render/world.js';
import { params, MAX_PR, pixelRatio, renderer, scene, camera, controls, clock, initScene, envRoom, envTarget, makeEnvironment, setLifecycle, storePixelRatio } from './render/scene.js';
import { nodes, nodesList, buildEngine } from './render/parts/nodes.js';
import { sim, phaseOf, updateKinematics } from './render/kinematics.js';
import { buildEffects, updateEffects, setEffectsSource } from './render/effects/strokes.js';
import { setAO, aoOn, renderFrame, disposePost } from './render/post.js';
import { SLOW_RUN, wantAO, lowDetail, slowRun, ADAPT0, adaptPR } from './render/quality.js';
import { ui, effSpeed, pickables, el } from './ui/state.js';
import { meanProgress, applyExplode, smoothExplode } from './ui/explode.js';
import { animateExplode, gotoStep } from './ui/steps.js';
import { tweenCamera, cameraPreset, homePosition } from './ui/camera.js';
import { setView } from './ui/view.js';
import { pick, select, isolate, setHover } from './ui/selection.js';
import { updateLabels } from './ui/labels.js';
import { updateMaterials } from './ui/highlight.js';
import { touch, setRunning, toggleRun, toast } from './ui/controls.js';
import { S, toastText } from './ui/strings.ru.js';
import { reducedMotion } from './ui/motion.js';
import { updateHud } from './ui/hud.js';
import { initUI, onResize, setInputLifecycle } from './ui/input.js';

/* ----------------------------------------------------------------------------
 * 1. КОНСТАНТЫ — мировые единицы: 1 ед. = 100 мм (соглашение модели) → src/render/world.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 2. МИНИ-TWEEN (замена GSAP) → src/anim/tween.js (M-02a)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 3. ДАННЫЕ: карточки деталей и шаги разборки → src/config/parts.js, src/config/steps.js (M-02a)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 4. СЦЕНА, СВЕТ, ОКРУЖЕНИЕ → src/render/scene.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 5. МАТЕРИАЛЫ → src/render/materials.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 6. ГЕОМЕТРИЯ: вспомогательные функции и сборщик merged-мешей → src/render/parts/ (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 7. КИНЕМАТИКА → src/render/kinematics.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 8. ЭФФЕКТЫ ТАКТОВ → src/render/effects/strokes.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 9. ЗВУК — синтез WebAudio (выключен по умолчанию) → src/audio/engine-audio.js (M-02a)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 10. ИНТЕРФЕЙС → src/ui/ (M-02c)
 * ------------------------------------------------------------------------- */
setSpeedSource(effSpeed);                   // M-02a: audio.fire() берёт текущую скорость отсюда
setEffectsSource(ui, effSpeed);             // M-02b: эффекты тактов читают ui.isolated, ui.view и effSpeed()

/* ----------------------------------------------------------------------------
 * 11. ЦИКЛ РЕНДЕРА
 * ------------------------------------------------------------------------- */
const perf = { frames: 0, t0: performance.now(), fps: 60, ad: ADAPT0, slow: 0, adaptive: !params.has('noadapt') };
const DEBUG = params.has('debug');         // M-05d: ?debug показывает индикатор fps (П-13); E-28 — как раньше
let lastTheta = 0;
function adapt() {
  perf.frames++;
  const now = performance.now(), el_ = (now - perf.t0) / 1000;
  if (el_ < 1) return;
  perf.fps = perf.frames / el_;
  perf.frames = 0; perf.t0 = now;
  if (perf.adaptive && !document.hidden) {
    perf.ad = adaptPR({ ...perf.ad, pr: pixelRatio }, perf.fps, MAX_PR);   // M-06b: с гистерезисом (render/quality.js)
    const pr = perf.ad.pr;
    perf.slow = aoOn() ? slowRun(perf.slow, perf.fps, pixelRatio) : 0;   // M-07a: медленно и при 1× — AO выключается
    if (perf.slow >= SLOW_RUN) setAO(false);
    if (pr !== pixelRatio) {
      storePixelRatio(pr);                  // M-02b: pixelRatio объявлен в render/scene.js
      renderer.setPixelRatio(pr);
      onResize();
    }
  }
  if (DEBUG) el.fps.textContent = S.fps(perf.fps, pixelRatio, aoOn());   // M-05d: индикатор только с ?debug (П-13)
}
function frame(dt) {
  updateTweens(dt);
  if (sim.running) sim.theta += effSpeed() * BASE_RPM / 60 * Math.PI * 2 * dt;
  const dPhi = clamp((sim.theta - lastTheta) / DEG, -90, 90);
  lastTheta = sim.theta;
  updateKinematics();
  smoothExplode(dt);
  applyExplode();
  updateMaterials(dt);
  updateEffects(dt, dPhi);
  audio.update(sim.running, effSpeed());

  if (ui.needHover) { ui.needHover = false; setHover(pick()); }
  controls.autoRotate = ui.autoRotate && !ui.camTw && performance.now() - ui.lastInteract > 2500;
  controls.update();

  updateHud();                              // M-05b: показания панелей → src/ui/hud.js
  updateLabels();

  renderFrame();                            // M-07a: с AO или прежний renderer.render()
  adapt();
}
function loop() {
  if (run.stopped) return;
  run.raf = requestAnimationFrame(loop);
  if (run.lost) return;                     // M-03: пауза, пока WebGL-контекст потерян
  try {
    frame(Math.min(clock.getDelta(), 0.05));
    run.errors = 0;
  } catch (err) {                           // M-03: ошибку кадра сообщаем один раз; если повторяется — останавливаем цикл
    if (++run.errors === 1) console.error(err);
    if (run.errors >= 30) {
      stopLoop();
      window.__engScreen('failed', '<b>3D-модель остановлена из-за ошибки.</b><br>' +
        window.__engEsc(err && err.message ? err.message : err) + '<br>Перезагрузите страницу.', ['reload']);
    }
  }
}

/* ----------------------------------------------------------------------------
 * M-03. ПОТЕРЯ WEBGL-КОНТЕКСТА, ОСТАНОВКА, DISPOSE
 * После restore three.js сам заново загружает геометрии, материалы, canvas-текстуры и карты теней;
 * окружение (PMREM) — результат рендера, его строим заново.
 * ------------------------------------------------------------------------- */
const run = { raf: 0, stopped: false, disposed: false, lost: false, errors: 0, timer: 0 };
const life = new AbortController();         // снимает слушатели window/document в dispose()
setLifecycle(life, onContextLost, onContextRestored);   // M-02b: initScene() из render/scene.js вешает их с life.signal
setInputLifecycle(life);                    // M-02c: initUI() из ui/input.js вешает слушатели window/document с life.signal
function stopLoop() { run.stopped = true; cancelAnimationFrame(run.raf); }
function onContextLost() {
  if (run.stopped) return;                  // после остановки сообщение об ошибке остаётся на экране
  run.lost = true;
  window.__engScreen('lost', 'Графика временно недоступна: браузер сбросил WebGL-контекст. Восстанавливаю…');
  clearTimeout(run.timer);
  run.timer = setTimeout(() => window.__engScreen('failed', '<b>Не удалось восстановить графику.</b><br>' +
    'Браузер не вернул WebGL-контекст. Перезагрузите страницу.', ['reload']), 10000);
}
function onContextRestored() {
  clearTimeout(run.timer);
  scene.environment = makeEnvironment();
  run.lost = false;
  if (window.__engOk && !run.stopped) window.__engScreen('ready');
}
function dispose() {
  if (run.disposed) return;
  run.disposed = true;
  stopLoop();
  clearTimeout(run.timer);
  life.abort();
  controls.dispose();
  const res = new Set([scene.background, envTarget]);
  [scene, envRoom].forEach(root => root.traverse(o => {
    if (o.isInstancedMesh) res.add(o);
    if (o.geometry) res.add(o.geometry);
    for (const m of [].concat(o.material || [])) {
      res.add(m);
      for (const v of Object.values(m).concat(Object.values(m.uniforms || {}).map(u => u.value))) if (v && v.isTexture) res.add(v);
    }
    if (o.shadow && o.shadow.map) res.add(o.shadow);
  }));
  res.forEach(r => r && r.dispose());
  if (audio.ctx) audio.ctx.close();
  disposePost();                            // M-07a: буферы и материалы AO
  renderer.dispose();
  renderer.forceContextLoss();              // внутренние объекты three.js (фон, материалы теней) уходят вместе с контекстом
}

/* ----------------------------------------------------------------------------
 * ЗАПУСК
 * ------------------------------------------------------------------------- */
function boot() {
  initScene();
  const coarse = matchMedia('(pointer: coarse)').matches, low = lowDetail(params, { coarse });   // M-07c: уровень «низкий»
  setAO(wantAO(params, { webgl2: renderer.capabilities.isWebGL2, coarse, low }));
  buildEngine(low);
  buildEffects();
  nodesList.forEach(n => n.traverse(o => { if (o.isMesh) pickables.push(o); }));
  sim.theta = 25 * DEG;
  lastTheta = sim.theta;
  initUI();
  el.fps.closest('.panel-foot').hidden = !DEBUG;
  // intro: fly in from afar (M-05d: при prefers-reduced-motion — сразу стартовый кадр, без пролёта)
  const dir = CAM_HOME.clone().sub(TGT_HOME).normalize();
  if (reducedMotion()) camera.position.copy(homePosition());
  else camera.position.copy(TGT_HOME).addScaledVector(dir, 34);
  controls.update();
  frame(0.016);
  window.__engOk = true;
  if (!run.lost) window.__engScreen('ready');
  if (!reducedMotion()) tweenCamera(homePosition(), TGT_HOME.clone(), 2.3, 0.1);   // M-05b: стартовый кадр по свободной области (П-4)
  setTimeout(() => toast(toastText('welcome', touch()), 5200), 1600);   // M-05d: без клавиш на устройствах без клавиатуры
  loop();
}
// test hooks (used by the automated browser check; harmless for users)
window.engine = {
  sim, ui, nodes, get renderer() { return renderer; }, get camera() { return camera; }, get controls() { return controls; },
  setView, toggleRun, setRunning, gotoStep, cameraPreset, select: k => select(k ? nodes[k] : null), isolate: k => isolate(k ? nodes[k] : null),
  setTheta: d => { sim.theta = d * DEG; }, phaseOf, pressureAt, frame, toggleLabels: () => el.btnLabels.click(),
  explode: v => animateExplode(v), dispose, setAO, busy: () => tweens.size + (meanProgress() !== Math.round(meanProgress()) && !ui.stepMode ? 1 : 0), meanProgress, stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, ao: aoOn() })
};
try { if (!window.__engStyleFailed) boot(); }   // M-05a: не загрузились стили — экран ошибки уже показан, сцену не собираем
catch (err) { console.error(err); window.__engFail('Ошибка при сборке сцены: ' + window.__engEsc(err && err.message ? err.message : err), ['reload']); }
