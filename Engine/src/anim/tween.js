/* Мини-движок анимаций (tween + easing) вместо GSAP. Без three и DOM.
 * M-02a: раздел 2 Engine/src/main.js, дословно. Тот же текст — в замороженной Engine/Engine.html (D-17),
 * совпадение проверяет tests/split-sync.test.js.
 */
const Ease = {
  linear: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};
const tweens = new Set();
/* tween({dur, delay, ease, onStart, onUpdate(k), onComplete}) → {kill()} */
function tween(o) {
  const tw = { t: -(o.delay || 0), dur: Math.max(1e-4, o.dur || 1), ease: o.ease || Ease.inOutCubic,
    onStart: o.onStart, onUpdate: o.onUpdate, onComplete: o.onComplete, started: false, dead: false,
    kill() { this.dead = true; tweens.delete(this); } };
  tweens.add(tw);
  return tw;
}
/* animate obj[key] → to; `from` captured when the tween actually starts (after delay) */
function tweenTo(obj, key, to, o = {}) {
  let from = 0;
  return tween({ ...o, onStart() { from = obj[key]; o.onStart && o.onStart(); },
    onUpdate(k) { obj[key] = from + (to - from) * k; o.onUpdate && o.onUpdate(k); } });
}
function updateTweens(dt) {
  for (const tw of Array.from(tweens)) {
    if (tw.dead) continue;
    tw.t += dt;
    if (tw.t < 0) continue;
    if (!tw.started) { tw.started = true; tw.onStart && tw.onStart(); }
    const k = Math.min(1, tw.t / tw.dur);
    tw.onUpdate && tw.onUpdate(tw.ease(k));
    if (k >= 1 && !tw.dead) { tw.dead = true; tweens.delete(tw); tw.onComplete && tw.onComplete(); }
  }
}

export { Ease, tweens, tween, tweenTo, updateTweens };
