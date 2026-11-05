/* M-07d: привод навесного оборудования поликлиновым ремнём — чистая геометрия, без three.js и DOM.
 * Плоскость ремня x = ACC_X — середина канавок демпфера коленвала (BELT_X + 0.15 + 0.107, render/parts/crankshaft.js);
 * в ней u = z, v = y, 1 ед. = 100 мм. Окружности DRIVE перечислены против часовой стрелки: r — радиус внутренней
 * поверхности ремня (вершины канавок шкива), s = 1 — шкив внутри петли, ремень огибает его рёбрами; s = −1 — ролик
 * снаружи петли, ремень огибает его спинкой.
 * beltLoop() — петля из общих касательных и дуг: точки внутренней поверхности ремня с нормалью наружу петли и путём s
 * от начала, углы обхвата, длины прямых участков и всей петли. accDrive(θ) — путь ремня и углы шкива генератора
 * и ролика при угле коленвала θ; markPeriod() — шаг метки на спинке, целое число шагов на длину петли.
 */
import { CRANK_Y } from '../config/engine-spec.js';

const ACC_X = 2.777;                                     // BELT_X + 0.15 + 0.107
const BELT_W = 0.144, BELT_T = 0.025, RIB_H = 0.016;     // 6 рёбер по 2,4 мм; толщина по спинке; высота ребра
const ALT = { u: 1.55, v: -0.05 };                       // ось генератора: сторона выпуска, низко
const IDLER_R = 0.10;                                    // ролик натяжителя — по спинке
const MARK = 0.12;                                       // шаг метки на спинке, примерно
const DRIVE = [
  { key: 'crank', u: 0, v: CRANK_Y, r: 0.34, s: 1 },
  { key: 'alt', u: ALT.u, v: ALT.v, r: 0.13, s: 1 },
  { key: 'idler', u: 0.82, v: 0.34, r: IDLER_R + BELT_T, s: -1 }
];

function beltLoop(C = DRIVE, stepDeg = 6) {
  const n = C.length, tan = [];
  for (let i = 0; i < n; i++) {
    const a = C[i], b = C[(i + 1) % n];
    const du = b.u - a.u, dv = b.v - a.v, L = Math.hypot(du, dv), dx = du / L, dy = dv / L;
    const k = (a.s * a.r - b.s * b.r) / L;
    if (!(Math.abs(k) < 1)) throw new Error(`beltLoop: у ${a.key} и ${b.key} нет общей касательной`);
    // нормаль наружу петли: направление a → b, повёрнутое по часовой стрелке на acos(k); точки касания — c + s·r·n
    const g = Math.acos(k), nu = dx * Math.cos(g) + dy * Math.sin(g), nv = dy * Math.cos(g) - dx * Math.sin(g);
    tan.push({ nu, nv, len: Math.abs(L * Math.sin(g)) });
  }
  const pts = [], wraps = [], seg = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const c = C[i], tIn = tan[(i - 1 + n) % n], tOut = tan[i];
    const aIn = Math.atan2(c.s * tIn.nv, c.s * tIn.nu);
    let aOut = Math.atan2(c.s * tOut.nv, c.s * tOut.nu);
    // шкив внутри петли — дуга против часовой стрелки, ролик снаружи — по часовой
    if (c.s > 0) while (aOut < aIn) aOut += Math.PI * 2; else while (aOut > aIn) aOut -= Math.PI * 2;
    const w = Math.abs(aOut - aIn), steps = Math.max(2, Math.ceil(w / (stepDeg * Math.PI / 180)));
    for (let k = 0; k <= steps; k++) {
      const a = aIn + (aOut - aIn) * k / steps, cu = Math.cos(a), cv = Math.sin(a);
      pts.push({ u: c.u + c.r * cu, v: c.v + c.r * cv, nu: c.s * cu, nv: c.s * cv, s: s + c.r * w * k / steps });
    }
    wraps.push(w); seg.push(tOut.len);
    s += c.r * w + tOut.len;
  }
  return { pts, wraps, seg, length: s };
}
const accDrive = theta => {
  const s = theta * DRIVE[0].r;
  return { s, alt: s / DRIVE[1].r, idler: -s / (DRIVE[2].r - BELT_T) };
};
const markPeriod = length => length / Math.max(1, Math.round(length / MARK));

export { ACC_X, BELT_W, BELT_T, RIB_H, ALT, IDLER_R, MARK, DRIVE, beltLoop, accDrive, markPeriod };
