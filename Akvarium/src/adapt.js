/**
 * Адаптивное разрешение аквариума (A-01, вынесено из main.js в A-02): чистая функция adaptStep и её параметры ADAPT —
 * без DOM и three.js. Встраивание (окно измерения, разогрев, ?noadapt, сброс после фоновой вкладки) — в main.js.
 * tests/adaptive.test.js вырезает блок между метками @pure и проверяет его в node:vm.
 * A-05b (Р-A14): кроме среднего fps за окно учитывается доля долгих кадров (аргумент jank) — бюджет p95 кадра ≤ 25 мс.
 */
// @pure adaptStep begin
/* Одно измерение — окно ≥ WIN с (в среднем fps за окно). Как и раньше: fps < LOW два окна подряд — pixelRatio ниже на STEP
 * (не ниже MIN). Новое: fps > HIGH hold окон подряд — выше на STEP (не выше maxPR); если в первые TRIAL окон после повышения
 * разрешение снова пришлось снизить, повышение не удалось, и следующего ждём вдвое дольше (3 → 6 → 12 → 24 окна, то есть 6 → 48 с).
 * Повышение, продержавшееся TRIAL окон, возвращает ожидание к HOLD. Измерения начинаются через WARM с после первого кадра.
 * s — состояние прошлого шага (в начале — ADAPT0 с pr), возвращается новое; s не меняется. */
// Р-A13 (A-05, утверждено 9 ноября 2026 г.): LOW 45 → 55 — разрешение снижается, когда кадр ниже бюджета iGPU (≥ 55 кадров/с).
// Р-A14 (A-05b, 9 ноября 2026 г.): jank — доля кадров дольше LONG (25 мс) за окно, 0…1; по умолчанию 0 — как в A-05.
// jank > JANK (5 %) — окно медленное и при fps ≥ LOW; подъём — только при jank ≤ JANK_UP (2 %). Бюджет iGPU: p95 кадра ≤ 25 мс.
const ADAPT = { WIN: 2, WARM: 5, LOW: 55, HIGH: 58, STEP: 0.25, MIN: 0.75, SLOW: 2, HOLD: 3, HOLD_MAX: 24, TRIAL: 5, LONG: 0.025, JANK: 0.05, JANK_UP: 0.02 };
const ADAPT0 = { pr: 1, slow: 0, good: 0, hold: ADAPT.HOLD, since: Infinity };
function adaptStep(s, fps, maxPR, jank = 0) {
  let { pr, slow, good, hold, since } = s;
  since++;
  if (fps < ADAPT.LOW || jank > ADAPT.JANK) {
    good = 0;
    if (pr > ADAPT.MIN && ++slow >= ADAPT.SLOW) {
      if (since <= ADAPT.TRIAL) hold = Math.min(ADAPT.HOLD_MAX, hold * 2);
      pr = Math.max(ADAPT.MIN, pr - ADAPT.STEP); slow = 0; since = Infinity;
    }
  } else {
    slow = 0;
    if (since === ADAPT.TRIAL + 1) hold = ADAPT.HOLD;
    if (fps > ADAPT.HIGH && jank <= ADAPT.JANK_UP) { if (++good >= hold && pr < maxPR) { pr = Math.min(maxPR, pr + ADAPT.STEP); good = 0; since = 0; } }
    else good = 0;
  }
  return { pr, slow, good, hold, since };
}
// @pure adaptStep end

export { ADAPT, ADAPT0, adaptStep };
