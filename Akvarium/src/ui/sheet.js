/**
 * Панель на телефоне — нижняя шторка (A-02, по образцу Engine M-05c). Уже 760 px панель становится шторкой с тремя
 * высотами: свёрнутая — ручка и кнопки «Покормить», «Стук», «Снимок» (они всегда видны), половина окна и почти всё
 * окно. Ручка: касание, Enter или Space — следующая высота по кругу, стрелки — выше и ниже, перетаскивание —
 * ближайшая высота, быстрый взмах — следующая в его сторону. Скрытая часть шторки — inert. При повороте телефона
 * панель сама переходит между шторкой и боковой панелью. Чистые функции (stopHeight, snapStop, nextStop) проверяет
 * tests/sheet.test.js; DOM — только в initSheet().
 */
const SHEET_MIN = 96, SHEET_HALF = 0.5, SHEET_FULL = 0.85, FLING_MS = 150, FLING_V = 0.4, TAP_PX = 8;
const STOPS = ['min', 'half', 'full'];
const PHONE = '(max-width: 759px)';

// высота шторки в px для окна высотой H; safe — безопасная зона снизу (env(safe-area-inset-bottom))
function stopHeight(stop, H, safe = 0) {
  const min = SHEET_MIN + safe, half = Math.max(min, Math.round(H * SHEET_HALF)), full = Math.max(half, Math.round(H * SHEET_FULL));
  return stop === 'full' ? full : stop === 'half' ? half : min;
}
// куда встать после перетаскивания: h — высота при отпускании, v — скорость (px/мс, больше 0 — вверх)
function snapStop(h, v, H, safe = 0) {
  const hs = STOPS.map(s => stopHeight(s, H, safe));
  if (v > FLING_V) { const i = hs.findIndex(x => x > h + 1); return STOPS[i < 0 ? 2 : i]; }
  if (v < -FLING_V) { const i = hs.findLastIndex(x => x < h - 1); return STOPS[i < 0 ? 0 : i]; }
  let best = 0;
  hs.forEach((x, k) => { if (Math.abs(x - h) < Math.abs(hs[best] - h)) best = k; });
  return STOPS[best];
}
// dir = 0 — по кругу, +1 и −1 — выше и ниже без перехода через край
const nextStop = (stop, dir = 0) => {
  const i = STOPS.indexOf(stop);
  return STOPS[dir ? Math.min(2, Math.max(0, i + dir)) : (i + 1) % 3];
};

const SHEET = { on: false, stop: 'min', h: 0 };   // on — режим шторки; h — высота в px (0 вне режима)
let setStop = () => {};

// el: panel, grip, body (#pbody), btns, keys; onChange() — после каждой смены режима или высоты
function initSheet(el, onChange) {
  const mq = matchMedia(PHONE), root = document.documentElement;
  const safe = () => parseFloat(getComputedStyle(el.panel).paddingBottom) || 0;
  let drag = null;
  const apply = () => {
    SHEET.h = SHEET.on ? stopHeight(SHEET.stop, innerHeight, safe()) : 0;
    el.panel.style.height = SHEET.on ? SHEET.h + 'px' : '';
    root.style.setProperty('--sheet-h', SHEET.h + 'px');
    el.panel.classList.toggle('hid', SHEET.on ? SHEET.stop === 'min' : el.panel.classList.contains('hid'));
    el.body.inert = SHEET.on && SHEET.stop === 'min';
    el.grip.setAttribute('aria-expanded', String(SHEET.on && SHEET.stop !== 'min'));
    onChange();
  };
  setStop = stop => {
    if (!SHEET.on) return;
    if (stop === 'min' && el.body.contains(document.activeElement)) el.grip.focus();
    SHEET.stop = stop; apply();
  };
  const mode = () => {
    SHEET.on = mq.matches;
    // кнопки — сразу под ручкой (порядок Tab = порядок на экране), на компьютере — на прежнем месте над подсказкой клавиш
    if (SHEET.on) el.panel.insertBefore(el.btns, el.grip.nextSibling); else el.body.insertBefore(el.btns, el.keys);
    root.classList.toggle('sheet', SHEET.on);
    if (SHEET.on) SHEET.stop = el.panel.classList.contains('hid') ? 'min' : SHEET.stop;
    apply();
  };
  mq.addEventListener('change', mode);
  addEventListener('resize', () => { if (SHEET.on) apply(); });
  // щелчок после перетаскивания не считается; Enter и Space (detail 0) — всегда следующая высота
  el.grip.addEventListener('click', e => { const dragged = drag && drag.moved && e.detail > 0; drag = null; if (!dragged) setStop(nextStop(SHEET.stop)); });
  el.grip.addEventListener('keydown', e => {
    const dir = e.code === 'ArrowUp' ? 1 : e.code === 'ArrowDown' ? -1 : 0;
    if (dir && SHEET.on) { e.preventDefault(); e.stopPropagation(); setStop(nextStop(SHEET.stop, dir)); }
  });
  // перетаскивание ручки: высота за пальцем, при отпускании — snapStop по скорости за последние FLING_MS мс
  // (по времени событий e.timeStamp: долгий кадр не превращает медленное перетаскивание во взмах и наоборот)
  el.grip.addEventListener('pointerdown', e => {
    if (!SHEET.on) return;
    drag = { y0: e.clientY, h0: SHEET.h, h: SHEET.h, moved: false, trail: [[e.timeStamp, e.clientY]] };
    el.grip.setPointerCapture(e.pointerId);
  });
  el.grip.addEventListener('pointermove', e => {
    if (!drag || !el.grip.hasPointerCapture(e.pointerId)) return;
    if (Math.abs(e.clientY - drag.y0) > TAP_PX && !drag.moved) { drag.moved = true; el.panel.classList.add('drag'); }
    if (!drag.moved) return;
    const s = safe(), now = e.timeStamp;
    drag.h = Math.min(stopHeight('full', innerHeight, s), Math.max(stopHeight('min', innerHeight, s), drag.h0 + drag.y0 - e.clientY));
    drag.trail.push([now, e.clientY]); while (drag.trail.length > 2 && now - drag.trail[0][0] > FLING_MS) drag.trail.shift();
    el.panel.style.height = drag.h + 'px'; root.style.setProperty('--sheet-h', drag.h + 'px');
  });
  const end = e => {
    if (!drag) return;
    el.panel.classList.remove('drag');
    if (drag.moved) {
      const [t0, y0] = drag.trail[0], v = (y0 - e.clientY) / Math.max(1, e.timeStamp - t0);
      setStop(snapStop(drag.h, v, innerHeight, safe()));
    }
  };
  el.grip.addEventListener('pointerup', end);
  el.grip.addEventListener('pointercancel', e => { end(e); drag = null; });
  mode();
}

export { FLING_MS, FLING_V, PHONE, SHEET, SHEET_FULL, SHEET_HALF, SHEET_MIN, STOPS, TAP_PX, initSheet, nextStop, setStop, snapStop, stopHeight };
