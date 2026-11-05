/* Сниженное движение (§7 в 14_M05; M-05d): при prefers-reduced-motion: reduce анимации камеры и разборки — не дольше
 * 150 мс и без задержек, разборка по ползунку — без сглаживания, нет пролёта камеры при старте и вспышки снимка;
 * переходы интерфейса выключает @media (prefers-reduced-motion: reduce) в styles/app.css. Настройка читается в момент
 * анимации: её можно менять, не перезагружая страницу. Автовращение и так выключено, пока его не включат (A).
 * motion(dur, delay) → { dur, delay } для tween() из anim/tween.js.
 */
const REDUCED_MAX = 0.15;                   // с
const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => !!(query && query.matches);
const motion = (dur, delay = 0) => reducedMotion() ? { dur: Math.min(dur, REDUCED_MAX), delay: 0 } : { dur, delay };

export { REDUCED_MAX, reducedMotion, motion };
