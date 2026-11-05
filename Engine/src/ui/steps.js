/* Разборка по шагам: exitStepMode(), animateExplode(), gotoStep(), nextStep(), prevStep() и панель шагов updateStepUI().
 * M-02c: из подразделов «explode / steps» и «step UI / sliders» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * gotoStep() и updateStepUI() вызывают друг друга (точки шагов), поэтому они в одном модуле.
 * M-05b: счётчик шагов — строчными буквами в подзаголовке «По шагам»: «шаг 4 из 9», до начала — «не начата».
 * M-05d: строки — из ui/strings.ru.js. Точки шагов создаются один раз и дальше только меняют классы и aria-current:
 * фокус с клавиатуры на точке не теряется после перехода. Имя точки — «Шаг 4: Головка блока». Длительность анимаций —
 * через motion() (ui/motion.js): при prefers-reduced-motion не дольше 150 мс и без задержек.
 */
import { clamp } from '../sim/math.js';
import { Ease, tweenTo } from '../anim/tween.js';
import { STEPS } from '../config/steps.js';
import { nodesList } from '../render/parts/nodes.js';
import { ui, el } from './state.js';
import { meanProgress, killNodeTweens, boundsWith } from './explode.js';
import { fitIfNeeded } from './camera.js';
import { motion } from './motion.js';
import { S } from './strings.ru.js';

function exitStepMode() {
  if (!ui.stepMode) return;
  ui.stepMode = false;
  killNodeTweens();
  ui.explode = meanProgress();
  updateStepUI();
}
function animateExplode(v) {
  exitStepMode();
  if (ui.explodeTw) ui.explodeTw.kill();
  const m = motion(1.3);
  ui.explodeTw = tweenTo(ui, 'explode', v, { dur: m.dur, ease: Ease.inOutCubic, onComplete() { ui.explodeTw = null; } });
}
function gotoStep(i) {
  i = clamp(i, -1, STEPS.length - 1);
  if (ui.explodeTw) { ui.explodeTw.kill(); ui.explodeTw = null; }
  const prev = ui.stepMode ? ui.step : -1;
  ui.stepMode = true;
  ui.step = i;
  const targets = {};
  nodesList.forEach(n => {
    const ud = n.userData, target = ud.stepIndex <= i ? 1 : 0;
    targets[ud.key] = target;
    if (Math.abs(ud.progress - target) < 1e-3 && !ud.tw) return;
    if (ud.tw) ud.tw.kill();
    const order = target ? ud.stepIndex - Math.max(0, prev) : Math.max(0, prev) - ud.stepIndex;
    const m = motion(0.95, 0.07 * clamp(order, 0, 6));
    ud.tw = tweenTo(ud, 'progress', target, { dur: m.dur, delay: m.delay, ease: Ease.inOutQuart, onComplete() { ud.tw = null; } });
  });
  updateStepUI();
  fitIfNeeded(boundsWith(targets));
}
function nextStep() { gotoStep(ui.stepMode ? ui.step + 1 : 0); }
function prevStep() { gotoStep(ui.stepMode ? ui.step - 1 : -1); }
function updateStepUI() {
  if (!el.stepDots.children.length) STEPS.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'dot';
    d.type = 'button';
    d.title = (i + 1) + '. ' + s.title;
    d.setAttribute('aria-label', S.stepDot(i + 1, s.title));
    d.addEventListener('click', () => gotoStep(i));
    el.stepDots.appendChild(d);
  });
  Array.from(el.stepDots.children).forEach((d, i) => {
    d.classList.toggle('done', ui.stepMode && i < ui.step);
    d.classList.toggle('now', ui.stepMode && i === ui.step);
    if (ui.stepMode && i === ui.step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
  });
  if (ui.stepMode && ui.step >= 0) {
    const s = STEPS[ui.step];
    el.stepCount.textContent = S.stepOf(ui.step + 1, STEPS.length);
    el.stepTitle.innerHTML = '<span>' + (ui.step + 1) + '.</span> ' + s.title;
    el.stepNote.textContent = s.note;
  } else {
    el.stepCount.textContent = ui.stepMode ? S.stepOf(0, STEPS.length) : S.notStarted;
    el.stepTitle.textContent = S.idleTitle;
    el.stepNote.innerHTML = S.idleNote;
  }
  el.btnPrev.disabled = !ui.stepMode || ui.step < 0;
  el.btnNext.disabled = ui.stepMode && ui.step >= STEPS.length - 1;
}

export { exitStepMode, animateExplode, gotoStep, nextStep, prevStep, updateStepUI };
