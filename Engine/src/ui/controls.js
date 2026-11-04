/* Панель управления: ползунки setRange(), скорость updateSpeedUI(), запуск и пауза setRunning() и toggleRun(),
 * поворот коленвала nudgeCrank(), уведомления toast(), скрытие и раскладка панелей, кнопки-переключатели, снимок
 * экрана screenshot().
 * M-02c: подраздел «step UI / sliders» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * Кроме updateStepUI() — она в ui/steps.js.
 * M-07a: снимок экрана рисуется через renderFrame() (render/post.js) — с тем же AO, что на экране.
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

/* ---------- step UI / sliders ---------- */
function setRange(r, v, pct) { if (document.activeElement !== r || !ui.scrubbing) r.value = v; r.style.setProperty('--p', pct + '%'); }
function speedFromSlider(v) { return 0.05 * Math.pow(200, v / 100); }
function updateSpeedUI() {
  const v = +el.speedSlider.value;
  sim.speed = speedFromSlider(v);
  el.speedSlider.style.setProperty('--p', v + '%');
  const e = effSpeed();
  el.speedVal.textContent = '×' + (e < 1 ? e.toFixed(2) : e.toFixed(1)) + ' · ' + (e * BASE_RPM < 10 ? (e * BASE_RPM).toFixed(1) : Math.round(e * BASE_RPM)) + ' об/мин';
}
function setRunning(v) {
  sim.running = v;
  el.btnRun.classList.toggle('on', v);
  el.btnRun.classList.toggle('accent', !v);
  el.btnRun.innerHTML = v ? '⏸ Пауза <kbd>Space</kbd>' : '▶ Запустить <kbd>Space</kbd>';
}
function toggleRun() {
  setRunning(!sim.running);
  if (sim.running) {
    audio.update(true, effSpeed());
    if (ui.firstRun && ui.view === 'solid') { setView('cut'); toast('Включил разрез, чтобы были видны такты. Вид меняется клавишей X'); }
    else if (meanProgress() > 0.15) toast('Механизм крутится и в разборке, а горение видно только в собранном двигателе');
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
function togglePanels(force) {
  const hide = force !== undefined ? force : !(el.hud.classList.contains('hid') && el.cycle.classList.contains('hid'));
  setPanel(el.hud, el.hudOpen, hide); setPanel(el.cycle, el.cycleOpen, hide);
}
function setPanel(p, btn, hide) { p.classList.toggle('hid', hide); btn.classList.toggle('on', hide); layoutPanels(); }
function layoutPanels() {
  if (innerWidth <= 760) { el.cycle.classList.remove('compact'); return; }
  el.cycle.classList.remove('compact');
  if (!el.infocard.classList.contains('open') || el.cycle.classList.contains('hid')) return;
  const natural = el.cycle.scrollHeight - el.pvWrap.clientHeight + el.pvWrap.scrollHeight + 16, cardTop = innerHeight - 16 - el.infocard.offsetHeight;
  if (natural > cardTop - 10) el.cycle.classList.add('compact');
}
function setToggle(btn, on) { btn.classList.toggle('act', on); }
function screenshot() {
  renderFrame();
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const d = new Date(), z = n => String(n).padStart(2, '0');
  a.download = `dvigatel-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.png`;
  a.href = url;
  document.body.appendChild(a); a.click(); a.remove();
  el.flash.style.transition = 'none'; el.flash.style.opacity = 0.55;
  requestAnimationFrame(() => { el.flash.style.transition = 'opacity .45s'; el.flash.style.opacity = 0; });
  toast('Снимок сохранён: ' + a.download, 2600);
}

export { setRange, updateSpeedUI, setRunning, toggleRun, nudgeCrank, toast, togglePanels, setPanel, layoutPanels, setToggle, screenshot };
