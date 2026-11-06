/**
 * Жесты на сцене без DOM и three.js (A-02). Клик или касание — корм (через dblMs, если не пришёл второй), двойной
 * клик или двойное касание — следить за рыбой, удержание без сдвига дольше HOLD_MS — сыпать корм, перетаскивание —
 * только вращение камеры, второй палец — только масштаб (корм и удержание отменяются). Без dblclick: на телефоне он
 * ненадёжен. Пороги мыши — прежние (6 px, 260 мс, 14 px), у пальца — свои: он дрожит сильнее и касается медленнее.
 * pickPx — допуск выбора рыбы пальцем (pickAt в main.js): мелкая рыба на телефоне меньше пальца.
 * main.js передаёт pointerdown / move / up / cancel со временем события (e.timeStamp: задержка кадра не ломает
 * двойное касание); удержание проверяет в кадре по performance.now() — та же шкала. Проверяет tests/gestures.test.js.
 */
const HOLD_MS = 380, TAP_MS = 600;
const KIND = { mouse: { movePx: 6, dblMs: 260, dblPx: 14, pickPx: 0 }, touch: { movePx: 10, dblMs: 300, dblPx: 30, pickPx: 16 } };
const kind = type => KIND[type === 'mouse' ? 'mouse' : 'touch'];

function createGestures() {
  const pts = new Set();
  let g = null, last = null;   // g — текущее нажатие одним указателем; last — касание, ждущее второго
  return {
    // нажатие: первым указателем — кандидат в касание; второй палец отменяет корм и удержание
    down(id, x, y, t, type) {
      if (pts.size === 0) g = { id, x, y, t, type, moved: false, held: false, multi: false };
      else if (g) g.multi = true;
      pts.add(id);
    },
    move(id, x, y) {
      if (g && id === g.id && !g.moved && Math.hypot(x - g.x, y - g.y) > kind(g.type).movePx) g.moved = true;
    },
    // true — один раз, когда удержание началось (main.js отменяет отложенный корм прошлого касания)
    hold(t) {
      if (!g || g.held || g.moved || g.multi || t - g.t <= HOLD_MS) return false;
      g.held = true; last = null; return true;
    },
    holding: () => !!(g && g.held && !g.moved && !g.multi),
    active: () => pts.size > 0,
    // отпускание: { type: 'tap', wait } — корм через wait мс, если не придёт второе; 'double' — второе касание; 'none'
    up(id, x, y, t) {
      pts.delete(id);
      if (!g || id !== g.id) { if (!pts.size) g = null; return { type: 'none' }; }
      const p = g; g = null;
      if (p.moved || p.held || p.multi || t - p.t > TAP_MS) return { type: 'none' };
      const k = kind(p.type);
      if (last && last.type === p.type && t - last.t <= k.dblMs && Math.hypot(x - last.x, y - last.y) < k.dblPx) { last = null; return { type: 'double' }; }
      last = { x, y, t, type: p.type };
      return { type: 'tap', wait: k.dblMs };
    },
    cancel(id) { pts.delete(id); if (g && id === g.id) g = null; },
  };
}

export { HOLD_MS, KIND, TAP_MS, createGestures };
