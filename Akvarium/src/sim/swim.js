/**
 * A-03d — кинематика плавания рыб: частота хвоста по числу Струхаля, крейсерское плавание грудными плавниками
 * (лабриформное) у хромисов, клоунов и обоих хирургов, C-старт при испуге. Без three и DOM: модуль работает в Node
 * и проверяется отдельно (tests/swim.test.js). main.js передаёт скорость и испуг, вершинный шейдер рыб (creatures.js)
 * читает aPhase (фаза волны тела) и aSwim (фаза грудных плавников, доля волны тела, изгиб C-старта, размах плавников).
 * Источники (aquarium-visuals): St = f·A/U ≈ 0,2–0,4 у плывущих животных — Taylor, Nudds, Thomas 2003 (Nature 425);
 * размах хвоста A ≈ 0,2 L — Bainbridge 1958; лабриформное плавание помацентровых, губановых и хирурговых — Fulton 2005,
 * Fulton 2007, Binning & Roche 2015; две стадии C-старта — Domenici & Blake 1997. Пороги GAIT, частоты FIN_*, доли
 * CRUISE_W и FIN_A, длительность C_T — подбор на глаз («гипотеза»); антиас и идол плавают телом и хвостом (BCF) — тоже
 * гипотеза. Стадия 1 C-старта у рыб длится десятки миллисекунд, здесь C_T растянут, чтобы изгиб был виден на экране.
 * Силы и скорости симуляции модуль не меняет и общий поток rnd() не трогает: это только анимация по скорости рыбы.
 * Функции не выделяют память: swimStep пишет в переданное состояние и возвращает его; dt = 0 (пауза) ничего не меняет.
 */
const TAU = Math.PI * 2;
const SWIM = {
  ST: 0.3,             // Strouhal number used for the tail beat (cruising swimmers: 0.2-0.4)
  APP: 1.6,            // tail-tip peak-to-peak / (amp * L) of FISH_VERT: envelope 0.8 at the tail tip, both sides
  TAIL_MIN: 0.6,       // Hz, idle sway (stylisation)
  TAIL_MAX: 4.5,       // Hz, display cap: >= 12 frames per beat at 55 fps (small real fish beat faster)
  FIN_MIN: 1.4,        // Hz, pectoral stroke while hovering (hypothesis)
  FIN_MAX: 3.2,        // Hz, pectoral stroke at the gait transition (hypothesis)
  GAIT: [0.55, 0.95],  // share of the top speed where labriform swimmers recruit body and tail (hypothesis)
  CRUISE_W: 0.2,       // body-wave share kept during the pectoral cruise
  FIN_A: 1.35,         // pectoral stroke amplitude in the cruise (1 = the previous look)
  W_RATE: 5,           // 1/s, smoothing of the body-wave share
  C_T: 0.3,            // s, C-start: stage 1 bend and stage 2 return stroke (slowed down, see above)
  C_RISE: 0.25,        // startle rise within one step that triggers a C-start
  C_REF: 1.2,          // s, refractory time between C-starts
};

// Initial state; phase = the fish's current aPhase, so the switch to this module does not jump
function SWIM0(phase = 0, pect = false) {
  const p = Math.abs(phase) || 0;
  return { tail: p % TAU, fin: (p * 0.7 + 1) % TAU, w: pect ? SWIM.CRUISE_W : 1, finA: pect ? SWIM.FIN_A : 1, bend: 0, ct: -1, cd: 0, side: 1, st: 0 };
}

function swimSm(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// C-start profile over x = t / C_T: a big bend to the turn side (stage 1), then a smaller return stroke (stage 2); peak ~1.02
function swimBend(x) { return x > 0 && x < 1 ? 1.45 * Math.sin(TAU * x) * Math.exp(-1.5 * x) : 0; }

// Tail-beat frequency [Hz] from the Strouhal number: f = St * U / A, A = tail-tip peak-to-peak amplitude (same units as U)
function tailHz(u, len, amp) { const A = SWIM.APP * amp * len; return A > 0 && u > 0 ? SWIM.ST * u / A : 0; }

// s: state from SWIM0; dt [s]; u: speed [u/s]; vmax: current top speed [u/s]; len: body length [u]; amp: species amp;
// st: startle 0..1; pect: labriform cruiser; side: +1 / -1, the side of the velocity in the fish's local x (turn side)
function swimStep(s, dt, u, vmax, len, amp, st, pect, side) {
  if (!(dt > 0)) return s;
  const q = vmax > 0 && u > 0 ? Math.min(1.5, u / vmax) : 0, k0 = Math.min(1, Math.max(0, st || 0));
  const fS = Math.min(SWIM.TAIL_MAX, Math.max(SWIM.TAIL_MIN, tailHz(u, len, amp)));
  const wT = pect ? SWIM.CRUISE_W + (1 - SWIM.CRUISE_W) * Math.max(swimSm(SWIM.GAIT[0], SWIM.GAIT[1], q), Math.min(1, k0 * 1.5)) : 1;
  s.w += (wT - s.w) * (1 - Math.exp(-dt * SWIM.W_RATE));
  const b = pect ? Math.min(1, Math.max(0, (s.w - SWIM.CRUISE_W) / (1 - SWIM.CRUISE_W))) : 1;   // 0 = pectoral cruise, 1 = body and tail
  const fF = pect ? SWIM.FIN_MIN + (SWIM.FIN_MAX - SWIM.FIN_MIN) * Math.min(1, q / SWIM.GAIT[1]) : 0;
  const fT = Math.min(SWIM.TAIL_MAX, (pect ? fF + (fS - fF) * b : fS) + 2 * k0);
  s.tail = (s.tail + TAU * fT * dt) % TAU;
  s.fin = (s.fin + TAU * (pect ? fF : 0.7 * fT) * dt) % TAU;
  s.finA = pect ? SWIM.FIN_A * (1 - 0.75 * b) : 1;
  s.cd = Math.max(0, s.cd - dt);
  if (s.ct < 0 && s.cd === 0 && k0 - s.st > SWIM.C_RISE) { s.ct = 0; s.cd = SWIM.C_REF; s.side = side < 0 ? -1 : 1; }
  else if (s.ct >= 0) { s.ct += dt; if (s.ct >= SWIM.C_T) s.ct = -1; }
  s.bend = s.ct >= 0 ? s.side * swimBend(s.ct / SWIM.C_T) : 0;
  s.st = k0;
  return s;
}

export { SWIM, SWIM0, swimBend, swimStep, tailHz };
