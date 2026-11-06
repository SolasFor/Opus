/**
 * Адаптивное разрешение аквариума (A-01, вынесено из main.js в A-02): чистая функция adaptStep и её параметры ADAPT —
 * без DOM и three.js. Встраивание (окно измерения, разогрев, ?noadapt, сброс после фоновой вкладки) — в main.js.
 * tests/adaptive.test.js вырезает блок между метками @pure и проверяет его в node:vm.
 */
// @pure adaptStep begin
/* Одно измерение — окно ≥ WIN с (в среднем fps за окно). Как и раньше: fps < LOW два окна подряд — pixelRatio ниже на STEP
 * (не ниже MIN). Новое: fps > HIGH hold окон подряд — выше на STEP (не выше maxPR); если в первые TRIAL окон после повышения
 * разрешение снова пришлось снизить, повышение не удалось, и следующего ждём вдвое дольше (3 → 6 → 12 → 24 окна, то есть 6 → 48 с).
 * Повышение, продержавшееся TRIAL окон, возвращает ожидание к HOLD. Измерения начинаются через WARM с после первого кадра.
 * s — состояние прошлого шага (в начале — ADAPT0 с pr), возвращается новое; s не меняется. */
const ADAPT = { WIN: 2, WARM: 5, LOW: 45, HIGH: 58, STEP: 0.25, MIN: 0.75, SLOW: 2, HOLD: 3, HOLD_MAX: 24, TRIAL: 5 };
const ADAPT0 = { pr: 1, slow: 0, good: 0, hold: ADAPT.HOLD, since: Infinity };
function adaptStep(s, fps, maxPR) {
  let { pr, slow, good, hold, since } = s;
  since++;
  if (fps < ADAPT.LOW) {
    good = 0;
    if (pr > ADAPT.MIN && ++slow >= ADAPT.SLOW) {
      if (since <= ADAPT.TRIAL) hold = Math.min(ADAPT.HOLD_MAX, hold * 2);
      pr = Math.max(ADAPT.MIN, pr - ADAPT.STEP); slow = 0; since = Infinity;
    }
  } else {
    slow = 0;
    if (since === ADAPT.TRIAL + 1) hold = ADAPT.HOLD;
    if (fps > ADAPT.HIGH) { if (++good >= hold && pr < maxPR) { pr = Math.min(maxPR, pr + ADAPT.STEP); good = 0; since = 0; } }
    else good = 0;
  }
  return { pr, slow, good, hold, since };
}
// @pure adaptStep end

export { ADAPT, ADAPT0, adaptStep };
