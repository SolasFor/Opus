/* Панель управления: ползунки setRange(), скорость updateSpeedUI(), запуск и пауза setRunning() и toggleRun(),
 * поворот коленвала nudgeCrank(), уведомления toast(), скрытие и раскладка панелей, кнопки-переключатели, снимок
 * экрана screenshot().
 * M-02c: подраздел «step UI / sliders» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * Кроме updateStepUI() — она в ui/steps.js.
 * M-07a: снимок экрана рисуется через renderFrame() (render/post.js) — с тем же AO, что на экране.
 * M-05b: кнопка запуска — значок и текст (runLabel), переключатели сообщают состояние через aria-pressed; скрытие
 * и раскладка панелей перенесены в ui/layout.js.
 * M-05d: строки и числа — из ui/strings.ru.js (П-12): «×1,0 · 31 об/мин»; на устройствах без клавиатуры уведомления
 * без упоминания клавиш (touch). Без вспышки снимка при prefers-reduced-motion (ui/motion.js).
 */
import { DEG } from '../config/engine-spec.js';
import { audio } from '../audio/engine-audio.js';
import { BASE_RPM } from '../render/world.js';
import { renderer } from '../render/scene.js';
import { renderFrame } from '../render/post.js';
import { sim } from '../render/kinematics.js';
import { ui, effSpeed, el } from './state.js';
import { meanProgress } from './explode.js';
import { setView } from './view.js';
import { runLabel } from './icons.js';
import { speedText, toastText, shotSaved } from './strings.ru.js';
import { reducedMotion } from './motion.js';

const touch = () => matchMedia('(pointer: coarse)').matches;

/* ---------- step UI / sliders ---------- */
function setRange(r, v, pct) { if (document.activeElement !== r || !ui.scrubbing) r.value = v; r.style.setProperty('--p', pct + '%'); }
function speedFromSlider(v) { return 0.05 * Math.pow(200, v / 100); }
function updateSpeedUI() {
  const v = +el.speedSlider.value;
  sim.speed = speedFromSlider(v);
  el.speedSlider.style.setProperty('--p', v + '%');
  const e = effSpeed();
  const s = speedText(e, e * BASE_RPM);
  el.speedVal.textContent = s;
  el.speedSlider.setAttribute('aria-valuetext', s);
}
function setRunning(v) {
  sim.running = v;
  el.btnRun.classList.toggle('on', v);
  el.btnRun.classList.toggle('accent', !v);
  el.btnRun.innerHTML = runLabel(v);
}
function toggleRun() {
  setRunning(!sim.running);
  if (sim.running) {
    audio.update(true, effSpeed());
    if (ui.firstRun && ui.view === 'solid') { setView('cut'); toast(toastText('cutOn', touch())); }
    else if (meanProgress() > 0.15) toast(toastText('explodedRun'));
    ui.firstRun = false;
  }
}
function nudgeCrank(deg) {
  if (sim.running) setRunning(false);
  sim.theta += deg * DEG;
}
let toastTimer = 0;
function toast(msg, ms = 3800) {
  el.toast.textContent = msg;
  el.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('on'), ms);
}
function setToggle(btn, on) { btn.classList.toggle('act', on); btn.setAttribute('aria-pressed', on); }
function screenshot() {
  renderFrame();
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const d = new Date(), z = n => String(n).padStart(2, '0');
  a.download = `dvigatel-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.png`;
  a.href = url;
  document.body.appendChild(a); a.click(); a.remove();
  if (!reducedMotion()) {                   // M-05d: без вспышки при prefers-reduced-motion
    el.flash.style.transition = 'none'; el.flash.style.opacity = 0.55;
    requestAnimationFrame(() => { el.flash.style.transition = 'opacity .45s'; el.flash.style.opacity = 0; });
  }
  toast(shotSaved(a.download), 2600);
}

export { touch, setRange, updateSpeedUI, setRunning, toggleRun, nudgeCrank, toast, setToggle, screenshot };
