/* Диаграмма фаз: такты четырёх цилиндров на 720°, метки искры и текущий угол — drawTiming(); разметка TL.
 * M-02c: из подраздела «HUD charts» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import { FIRE_DEG, SPARK_ADV } from '../../config/engine-spec.js';
import { mod } from '../../sim/math.js';
import { strokeOf } from '../../sim/cycle.js';
import { STROKES } from '../../render/world.js';
import { cycDeg, phaseOf } from '../../render/kinematics.js';
import { ui, el } from '../state.js';
import { charts } from './canvas.js';

const TL = { left: 26, right: 66, top: 8, row: 20 };
function drawTiming() {
  const { w, h, dpr } = charts.t, g = el.timing.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const x0 = TL.left, x1 = w - TL.right, X = d => x0 + (x1 - x0) * d / 720;
  const cd = cycDeg();
  g.font = '600 10.5px Inter, Segoe UI, system-ui, sans-serif';
  g.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const y = TL.top + i * TL.row, phi = phaseOf(i), sNow = strokeOf(phi);
    if (i === ui.pvCyl) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(2, y - 1, w - 4, TL.row - 2); }
    g.fillStyle = i === ui.pvCyl ? '#fff' : '#8d9aab';
    g.fillText('Ц' + (i + 1), 6, y + TL.row / 2 - 1);
    for (let k = 0; k < 4; k++) {
      const a = mod(FIRE_DEG[i] + k * 180, 720), b = a + 180;
      g.fillStyle = STROKES[k].color;
      g.globalAlpha = k === sNow ? 0.95 : 0.38;
      const seg = (s, e) => g.fillRect(X(s) + 0.5, y + 3, X(e) - X(s) - 1, TL.row - 8);
      if (b <= 720) seg(a, b); else { seg(a, 720); seg(0, b - 720); }
    }
    g.globalAlpha = 1;
    const sp = mod(FIRE_DEG[i] - SPARK_ADV, 720);   // spark mark
    g.fillStyle = '#fff3a8';
    g.beginPath(); g.moveTo(X(sp), y + 1); g.lineTo(X(sp) + 3.5, y - 3); g.lineTo(X(sp) - 3.5, y - 3); g.fill();
    g.fillStyle = STROKES[sNow].color;
    g.fillText(STROKES[sNow].short, x1 + 7, y + TL.row / 2 - 1);
  }
  g.fillStyle = '#5f6b7b'; g.font = '600 9px Inter, system-ui, sans-serif';
  [0, 180, 360, 540, 720].forEach(d => { g.textAlign = d === 0 ? 'left' : d === 720 ? 'right' : 'center'; g.fillText(d + '°', X(d), h - 6); });
  g.textAlign = 'left';
  const cx = X(cd);
  g.strokeStyle = '#fff'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx, TL.top - 4); g.lineTo(cx, TL.top + 4 * TL.row - 2); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, TL.top - 4, 2.6, 0, Math.PI * 2); g.fill();
}

export { TL, drawTiming };
