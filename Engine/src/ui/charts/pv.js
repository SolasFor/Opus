/* p–V диаграмма выбранного цилиндра: петля рисуется один раз, точка текущего состояния — в каждом кадре, drawPV().
 * M-02c: из подраздела «HUD charts» Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 */
import { VS, VC } from '../../config/engine-spec.js';
import { strokeOf } from '../../sim/cycle.js';
import { volumeAt, pressureAt } from '../../sim/thermo.js';
import { STROKES } from '../../render/world.js';
import { phaseOf } from '../../render/kinematics.js';
import { ui, el } from '../state.js';
import { charts } from './canvas.js';

const PV = { l: 34, r: 10, t: 10, b: 20, pMax: 60 };
function pvXY(V, p, w, h) {
  const vMin = VC * 0.9, vMax = (VC + VS) * 1.04;
  return [PV.l + (w - PV.l - PV.r) * (V - vMin) / (vMax - vMin), h - PV.b - (h - PV.t - PV.b) * Math.min(p, PV.pMax) / PV.pMax];
}
function drawPV() {
  const { w, h, dpr } = charts.p;
  if (!charts.pvBg) {   // static loop, drawn once
    const c = document.createElement('canvas');
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
    g.font = '600 9px Inter, system-ui, sans-serif'; g.fillStyle = '#5f6b7b';
    [0, 20, 40, 60].forEach(p => { const [, y] = pvXY(VC, p, w, h); g.beginPath(); g.moveTo(PV.l, y); g.lineTo(w - PV.r, y); g.stroke(); g.fillText(p, 6, y + 3); });
    const [xt] = pvXY(VC, 0, w, h), [xb] = pvXY(VC + VS, 0, w, h);
    g.textAlign = 'center';
    g.fillText('ВМТ', xt, h - 6); g.fillText('НМТ', xb, h - 6);
    g.fillText('V, см³ →', (xt + xb) / 2, h - 6);
    g.save(); g.translate(10, PV.t + 6); g.textAlign = 'left'; g.fillText('p, бар', 12, 0); g.restore();
    g.lineWidth = 2; g.lineJoin = 'round';
    for (let phi = 0; phi < 720; phi += 2) {
      const [xa, ya] = pvXY(volumeAt(phi), pressureAt(phi), w, h), [xb2, yb] = pvXY(volumeAt(phi + 2), pressureAt(phi + 2), w, h);
      g.strokeStyle = STROKES[strokeOf(phi)].color;
      g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb2, yb); g.stroke();
    }
    charts.pvBg = c;
  }
  const g = el.pv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, el.pv.width, el.pv.height);
  g.drawImage(charts.pvBg, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const phi = phaseOf(ui.pvCyl), p = pressureAt(phi), [x, y] = pvXY(volumeAt(phi), p, w, h);
  const col = STROKES[strokeOf(phi)].color;
  g.fillStyle = col; g.globalAlpha = 0.25;
  g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1; g.fillStyle = '#fff';
  g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = col; g.lineWidth = 2; g.stroke();
  el.pvVal.textContent = p.toFixed(1) + ' бар · ' + STROKES[strokeOf(phi)].name.toLowerCase();
}

export { drawPV };
