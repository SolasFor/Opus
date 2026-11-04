/* Эффекты тактов: свечение камер сгорания, искра и вспышка, частицы смеси на впуске и газов на выпуске.
 * M-02b: раздел 8 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * Состояние интерфейса ui и effSpeed() остаются в main.js (раздел 10): main.js передаёт их через
 * setEffectsSource(ui, effSpeed) при загрузке, до первого кадра.
 */
import * as THREE from 'three';
import { PIN_TOP, BORE_R, SPARK_ADV } from '../../config/engine-spec.js';
import { clamp01, mod, smooth } from '../../sim/math.js';
import { audio } from '../../audio/engine-audio.js';
import { CYL_X, HEAD_BOT, V3 } from '../world.js';
import { pixelRatio, engineRoot, flashLight } from '../scene.js';
import { nodes } from '../parts/nodes.js';
import { intakePaths, exhaustPaths } from '../parts/intake.js';
import { sim, _m4, _p, _s, _qI, cycDeg, phaseOf } from '../kinematics.js';

let ui, effSpeed;
const setEffectsSource = (state, speed) => { ui = state; effSpeed = speed; };

let chamberMesh, sparkSprite, flashSprite, inPts, exPts;
const fx = { chamber: 0, intake: 0, exhaust: 0, view: 0 };
function glowTexture(stops, size = 128, star = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), h = size / 2;
  const rg = g.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, col]) => rg.addColorStop(o, col));
  g.fillStyle = rg; g.fillRect(0, 0, size, size);
  if (star) {
    g.globalCompositeOperation = 'lighter';
    [[1, 0.06], [0.06, 1]].forEach(([sx, sy]) => {
      const lg = g.createRadialGradient(h, h, 0, h, h, h);
      lg.addColorStop(0, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.save(); g.translate(h, h); g.scale(sx, sy); g.translate(-h, -h); g.fillStyle = lg; g.fillRect(0, 0, size, size); g.restore();
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildEffects() {
  // chamber gas volumes: 4 instances, colour = additive intensity
  const geo = new THREE.CylinderGeometry(BORE_R - 0.02, BORE_R - 0.02, 1, 32, 1, false).translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vY;
      void main(){
        vCol = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #endif
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vY;
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = 0.25 + 0.75 * f * f;
        a *= 0.55 + 0.45 * smoothstep(0.0, 1.0, vY);   // denser near the roof (spark side)
        gl_FragColor = vec4(vCol * a, 1.0);
      }`
  });
  chamberMesh = new THREE.InstancedMesh(geo, mat, 4);
  chamberMesh.frustumCulled = false;
  chamberMesh.renderOrder = 5;
  for (let i = 0; i < 4; i++) chamberMesh.setColorAt(i, new THREE.Color(0, 0, 0));
  engineRoot.add(chamberMesh);

  sparkSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(200,225,255,0.95)'], [0.35, 'rgba(120,170,255,0.35)'], [1, 'rgba(80,120,255,0)']], 128, true),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  sparkSprite.scale.setScalar(0.32);
  sparkSprite.renderOrder = 7;
  flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,250,235,1)'], [0.2, 'rgba(255,200,110,0.8)'], [0.5, 'rgba(255,120,40,0.28)'], [1, 'rgba(255,80,20,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  flashSprite.renderOrder = 6;
  engineRoot.add(sparkSprite, flashSprite);

  inPts = makeParticles(intakePaths, 26, 0x5ab8ff, 0x9fe0ff, 0.075);
  exPts = makeParticles(exhaustPaths, 30, 0xffa040, 0x8a8f96, 0.09);
}

/* small GPU point clouds following precomputed path look-up tables */
function makeParticles(paths, per, colA, colB, size) {
  const LUT_N = 160;
  const luts = paths.map(p => p.getSpacedPoints(LUT_N - 1));
  const N = paths.length * per;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), aT = new Float32Array(N), aA = new Float32Array(N), aS = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const parts = [];
  for (let c = 0; c < paths.length; c++) for (let k = 0; k < per; k++) {
    parts.push({ cyl: c, s: (k + Math.random() * 0.8) / per, j: V3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.16) });
    aS[parts.length - 1] = 0.6 + Math.random() * 0.8;
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) }, uSize: { value: size }, uScale: { value: innerHeight * pixelRatio * 0.5 }, uVis: { value: 1 } },
    vertexShader: `
      attribute float aT; attribute float aA; attribute float aS;
      uniform float uSize; uniform float uScale;
      varying float vT; varying float vA;
      void main(){
        vT = aT; vA = aA;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float grow = 1.0 + 2.2 * smoothstep(0.82, 1.0, aT);
        gl_PointSize = uSize * aS * grow * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform float uVis;
      varying float vT; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d) * 4.0;
        if (r > 1.0) discard;
        float soft = (1.0 - r) * (1.0 - r);
        vec3 col = mix(uA, uB, smoothstep(0.25, 0.85, vT));
        gl_FragColor = vec4(col * soft * vA * uVis, 1.0);
      }`
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 8;
  engineRoot.add(points);
  return { points, parts, luts, LUT_N, geo, pos, aT, aA };
}
function stepParticles(P, lifts, dPhi, k, vis) {
  const { parts, luts, LUT_N, pos, aT, aA } = P;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const flow = lifts[p.cyl];
    p.s += flow * dPhi * k;
    if (p.s > 1 || p.s < 0) p.s -= Math.floor(p.s);   // one frame can move a particle by more than one period (|dPhi| <= 90°)
    const f = p.s * (LUT_N - 1), i0 = Math.floor(f), i1 = Math.min(LUT_N - 1, i0 + 1), t = f - i0;
    const a = luts[p.cyl][i0], b = luts[p.cyl][i1];
    const spread = 1 + 3.5 * smooth(0.86, 1.0, p.s);       // puffs spread once out in the open
    pos[i * 3] = a.x + (b.x - a.x) * t + p.j.x * spread;
    pos[i * 3 + 1] = a.y + (b.y - a.y) * t + p.j.y * spread;
    pos[i * 3 + 2] = a.z + (b.z - a.z) * t + p.j.z * spread;
    aT[i] = p.s;
    const edge = smooth(0, 0.04, p.s) * (1 - smooth(0.9, 1.0, p.s));
    aA[i] = edge * (0.25 + 0.75 * Math.min(1, flow * 1.6));
  }
  P.geo.attributes.position.needsUpdate = true;
  P.geo.attributes.aT.needsUpdate = true;
  P.geo.attributes.aA.needsUpdate = true;
  P.points.material.uniforms.uVis.value = vis;
  P.points.visible = vis > 0.01;
}

const _col = new THREE.Color();
function chamberColor(phi, out) {
  const pc = phi >= 700 ? phi - 720 : phi;   // −20 … 700
  let r = 0, g = 0, b = 0;
  if (pc >= -SPARK_ADV && pc < 180) {
    const t = pc + SPARK_ADV;
    const flash = Math.exp(-Math.pow((t - 15) / 8, 2));
    const burn = smooth(2, 16, t) * Math.exp(-t / 60);
    r = 1.7 * flash + 1.05 * burn; g = 1.3 * flash + 0.40 * burn; b = 0.85 * flash + 0.06 * burn;
  } else if (phi >= 180 && phi < 360) {
    const k = 1 - (phi - 180) / 180;
    r = 0.05 + 0.20 * k; g = 0.05 + 0.10 * k; b = 0.05 + 0.04 * k;
  } else if (phi >= 360 && phi < 540) {
    const k = smooth(360, 540, phi);
    r = 0.02; g = 0.08 + 0.08 * k; b = 0.18 + 0.16 * k;
  } else {
    const k = clamp01((phi - 540) / 170);
    r = 0.05 + 0.20 * k; g = 0.12 + 0.03 * k; b = 0.34 + 0.16 * k;
  }
  return out.setRGB(r, g, b);
}
/* flash curve (0..1) of the combustion just after the spark */
function flashAmount(phi) {
  const pc = phi >= 700 ? phi - 720 : phi;
  if (pc < -SPARK_ADV || pc > 100) return 0;
  const t = pc + SPARK_ADV;
  return Math.exp(-Math.pow((t - 15) / 10, 2)) + 0.25 * smooth(5, 20, t) * Math.exp(-t / 40);
}

let lastPhi = null;
function updateEffects(dt, dPhi) {
  const P = k => nodes[k].userData.progress;
  const asm = 1 - smooth(0.02, 0.15, Math.max(P('head'), P('block'), P('pistons')));
  const isoKey = ui.isolated ? ui.isolated.userData.key : null;
  const isoOK = k => !isoKey || isoKey === k;
  fx.chamber = asm * (isoKey ? 0 : 1);
  fx.intake = asm * (1 - smooth(0.02, 0.15, P('intake'))) * (isoOK('intake') ? 1 : 0);
  fx.exhaust = asm * (1 - smooth(0.02, 0.15, P('exhaust'))) * (isoOK('exhaust') ? 1 : 0);
  const inside = ui.view === 'solid' ? 0.35 : 1;

  // chamber gas
  let fireCyl = -1, fireAmt = 0, sparkCyl = -1, sparkAmt = 0;
  for (let i = 0; i < 4; i++) {
    const phi = phaseOf(i);
    const crown = sim.pistonY[i] + PIN_TOP + 0.012;
    _m4.compose(_p.set(CYL_X[i], crown, 0), _qI, _s.set(1, Math.max(0.001, HEAD_BOT - crown), 1));
    chamberMesh.setMatrixAt(i, _m4);
    chamberColor(phi, _col).multiplyScalar(fx.chamber);
    chamberMesh.setColorAt(i, _col);
    const fa = flashAmount(phi);
    if (fa > fireAmt) { fireAmt = fa; fireCyl = i; }
    const pc = phi >= 700 ? phi - 720 : phi;
    const sp = (pc >= -SPARK_ADV - 1 && pc < -SPARK_ADV + 7) ? 1 - Math.abs(pc + SPARK_ADV - 2) / 5 : 0;
    if (sp > sparkAmt) { sparkAmt = sp; sparkCyl = i; }
  }
  chamberMesh.instanceMatrix.needsUpdate = true;
  chamberMesh.instanceColor.needsUpdate = true;
  chamberMesh.visible = fx.chamber > 0.01;

  // spark at the plug tip (+ a little flicker), flash ball + one moving point light
  if (sparkCyl >= 0 && fx.chamber > 0.01) {
    sparkSprite.position.set(CYL_X[sparkCyl], HEAD_BOT - 0.045, 0);
    sparkSprite.material.opacity = clamp01(sparkAmt) * fx.chamber * (0.75 + 0.25 * Math.random());
    sparkSprite.material.rotation = Math.random() * Math.PI;
  } else sparkSprite.material.opacity = 0;
  sparkSprite.visible = sparkSprite.material.opacity > 0.01;
  if (fireCyl >= 0 && fx.chamber > 0.01) {
    const crown = sim.pistonY[fireCyl] + PIN_TOP;
    flashSprite.position.set(CYL_X[fireCyl], (crown + HEAD_BOT) / 2 + 0.02, 0.05);
    flashSprite.scale.setScalar(0.7 + 0.9 * Math.min(1, fireAmt));
    flashSprite.material.opacity = Math.min(1, fireAmt) * fx.chamber;
    flashLight.position.copy(flashSprite.position);
    flashLight.intensity = 9 * Math.min(1.2, fireAmt) * fx.chamber * inside;
  } else { flashSprite.material.opacity = 0; flashLight.intensity = 0; }
  flashSprite.visible = flashSprite.material.opacity > 0.01;

  // particles move with the crank (so scrubbing moves them too)
  stepParticles(inPts, sim.intakeLift, dPhi, 1 / 85, fx.intake);
  stepParticles(exPts, sim.exhaustLift, dPhi, 1 / 75, fx.exhaust);

  // exhaust heat builds up slowly with speed, cools when stopped
  const target = sim.running ? clamp01((effSpeed() - 0.6) / 5) : 0;
  sim.heat += (target - sim.heat) * (1 - Math.exp(-dt * (target > sim.heat ? 0.35 : 0.2)));

  // sound: one thump per combustion event
  if (lastPhi !== null && dPhi > 0 && dPhi < 360) {
    for (let i = 0; i < 4; i++) {
      const now = phaseOf(i), before = mod(now - dPhi, 720);
      if (before > now && fx.chamber > 0.01) audio.fire(i);   // crossed TDC (wrap 720 → 0)
    }
  }
  lastPhi = cycDeg();
}

export { inPts, exPts, fx, buildEffects, updateEffects, setEffectsSource };
