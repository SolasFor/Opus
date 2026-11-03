/* Engine — модульная версия (M-01b). Открывается только по HTTP (D-15): GitHub Pages или локальный сервер,
 * например `python3 -m http.server` в корне репозитория. Без сервера работает однофайловая Engine/Engine.html.
 * Основа — встроенный модуль Engine/Engine.html, перенесённый дословно. Шов модели: константы и функции модели
 * импортируются из ./config и ./sim (их тождество с копиями в Engine.html проверяют spec-sync.test.js
 * и legacy-parity.test.js), cycDeg и phaseOf — обёртки над cycleDeg и cylinderPhaseDeg с аргументом sim.theta.
 * С X-01 Engine.html заморожен (D-17): изменения вносятся только сюда, заморозку проверяет tests/legacy-freeze.test.js.
 * M-03: сообщения о сбоях запуска (экран загрузки в index.html), потеря и восстановление WebGL-контекста,
 * остановка цикла при повторяющейся ошибке кадра, engine.dispose().
 * M-02a: разделы 2, 3 и 9 (мини-tween, карточки деталей и шаги разборки, звук) перенесены дословно в src/anim/tween.js,
 * src/config/parts.js, src/config/steps.js и src/audio/engine-audio.js; дословность проверяет tests/split-sync.test.js.
 */
/* ============================================================================
 * ЧЕТЫРЁХТАКТНЫЙ ДВИГАТЕЛЬ — интерактивная 3D-разборка (рядная «четвёрка», DOHC 16V)
 * Один файл · Three.js 0.160 (ES-модули с CDN через importmap) · всё процедурно.
 *
 *  1. Константы геометрии и фаз газораспределения (цикл 720°, порядок 1-3-4-2)
 *  2. Мини-движок анимаций (tween + easing) вместо GSAP
 *  3. Данные: карточки деталей, шаги разборки
 *  4. Сцена, свет, окружение (PMREM RoomEnvironment), пол
 *  5. Материалы (+ шейдер «сечения» для разреза)
 *  6. Процедурные детали: каждая — узел (THREE.Group) с merged-геометрией / InstancedMesh
 *  7. Кинематика: кривошипно-шатунный механизм, кулачки → клапаны, ремень ГРМ
 *  8. Эффекты тактов: свечение камер, искра, вспышка, частицы смеси и выхлопа
 *  9. Звук (WebAudio, синтез)
 * 10. Интерфейс: разборка, шаги, вид/разрез, камера, подписи, карточки, диаграммы
 * 11. Цикл рендера, адаптивное разрешение, запуск
 * ========================================================================== */
import * as THREE from 'three';
import { DEG, FIRE_DEG, CRANK_Y, CRANK_R, ROD_L, PIN_TOP, BORE_R, CAM_LIFT, SPARK_ADV, VS, VC } from './config/engine-spec.js';
import { clamp, clamp01, mod, smooth } from './sim/math.js';
import { cycleDeg, cylinderPhaseDeg, strokeOf } from './sim/cycle.js';
import { PIN_TDC } from './sim/kinematics.js';
import { camProfileLift, valveDownAngle, lobeAngle } from './sim/valvetrain.js';
import { volumeAt, pressureAt } from './sim/thermo.js';
import { Ease, tweens, tween, tweenTo, updateTweens } from './anim/tween.js';
import { STEPS } from './config/steps.js';
import { audio, setSpeedSource } from './audio/engine-audio.js';
import { CYL_X, HEAD_BOT, R_CRANK_SPR, IDLER, BASE_RPM, CAM_HOME, TGT_HOME, STROKES, V3, $ } from './render/world.js';
import { params, MAX_PR, pixelRatio, renderer, scene, camera, controls, clock, engineRoot, flashLight, cutPlane, CAP, initScene, envRoom, envTarget, makeEnvironment, setLifecycle, storePixelRatio } from './render/scene.js';
import { nodes, nodesList, buildEngine } from './render/parts/nodes.js';
import { crankGroup } from './render/parts/crankshaft.js';
import { rodMeshes } from './render/parts/rods.js';
import { pistonMeshes } from './render/parts/pistons.js';
import { valveMeshes, springMeshes, camShafts, valves, SPRING_BASE, SPRING_TOP } from './render/parts/valvetrain.js';
import { intakePaths, exhaustPaths } from './render/parts/intake.js';
import { beltMat, idlerGroup, BELT_PITCH } from './render/parts/belt.js';

/* ----------------------------------------------------------------------------
 * 1. КОНСТАНТЫ — мировые единицы: 1 ед. = 100 мм (соглашение модели) → src/render/world.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 2. МИНИ-TWEEN (замена GSAP) → src/anim/tween.js (M-02a)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 3. ДАННЫЕ: карточки деталей и шаги разборки → src/config/parts.js, src/config/steps.js (M-02a)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 4. СЦЕНА, СВЕТ, ОКРУЖЕНИЕ → src/render/scene.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 5. МАТЕРИАЛЫ → src/render/materials.js (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 6. ГЕОМЕТРИЯ: вспомогательные функции и сборщик merged-мешей → src/render/parts/ (M-02b)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 7. КИНЕМАТИКА
 * ------------------------------------------------------------------------- */
const sim = {
  theta: 0,                // crank angle, rad (unbounded); cycle angle = θ mod 4π
  running: false, speed: 1, slow: false,
  pistonY: [0, 0, 0, 0], intakeLift: [0, 0, 0, 0], exhaustLift: [0, 0, 0, 0],
  heat: 0
};
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _qI = new THREE.Quaternion(), _up = V3(0, 1, 0), _d = new THREE.Vector3(), _one = V3(1, 1, 1);
const cycDeg = () => cycleDeg(sim.theta);
const phaseOf = i => cylinderPhaseDeg(sim.theta, i);                   // 0 = TDC, start of power stroke

function updateKinematics() {
  const th = sim.theta;
  crankGroup.rotation.x = th;
  camShafts.forEach(c => { c.rotation.x = th / 2; });
  for (let i = 0; i < 4; i++) {
    const a = th - FIRE_DEG[i] * DEG;
    const pinY = CRANK_Y + CRANK_R * Math.cos(a), pinZ = CRANK_R * Math.sin(a);
    const py = pinY + Math.sqrt(ROD_L * ROD_L - pinZ * pinZ);
    sim.pistonY[i] = py;
    _m4.compose(_p.set(CYL_X[i], py, 0), _qI, _one);
    pistonMeshes.forEach(m => m.setMatrixAt(i, _m4));
    _d.set(0, py - pinY, -pinZ).normalize();
    _q.setFromUnitVectors(_up, _d);
    _m4.compose(_p.set(CYL_X[i], pinY, pinZ), _q, _one);
    rodMeshes.forEach(m => m.setMatrixAt(i, _m4));
  }
  sim.intakeLift.fill(0); sim.exhaustLift.fill(0);
  for (let v = 0; v < valves.length; v++) {
    const vl = valves[v];
    // lift read straight off the actual cam lobe orientation → cams and valves can never disagree
    const lift = camProfileLift(th / 2 + lobeAngle(vl.type, vl.cyl) - valveDownAngle(vl.type));
    vl.lift = lift;
    if (vl.type === 'intake') sim.intakeLift[vl.cyl] = lift / CAM_LIFT; else sim.exhaustLift[vl.cyl] = lift / CAM_LIFT;
    _p.copy(vl.seat).addScaledVector(vl.axis, -lift);
    _m4.compose(_p, vl.quat, _one);
    valveMeshes.forEach(m => m.setMatrixAt(v, _m4));
    _p.copy(vl.seat).addScaledVector(vl.axis, SPRING_BASE);
    _s.set(1, SPRING_TOP - SPRING_BASE - lift, 1);
    _m4.compose(_p, vl.quat, _s);
    springMeshes.forEach(m => m.setMatrixAt(v, _m4));
  }
  [...pistonMeshes, ...rodMeshes, ...valveMeshes, ...springMeshes].forEach(m => { m.instanceMatrix.needsUpdate = true; });
  // belt teeth travel at the crank sprocket pitch speed; idler spins at v / r
  if (beltMat) beltMat.map.offset.x = th * R_CRANK_SPR / BELT_PITCH;
  if (idlerGroup) idlerGroup.rotation.x = th * R_CRANK_SPR / IDLER.r;
}

/* ----------------------------------------------------------------------------
 * 8. ЭФФЕКТЫ ТАКТОВ
 * ------------------------------------------------------------------------- */
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

/* ----------------------------------------------------------------------------
 * 9. ЗВУК — синтез WebAudio (выключен по умолчанию) → src/audio/engine-audio.js (M-02a)
 * ------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * 10. ИНТЕРФЕЙС
 * ------------------------------------------------------------------------- */
const ui = {
  explode: 0, explodeTw: null, stepMode: false, step: -1,
  view: 'solid', cutZ: 0, labels: false, autoRotate: false,
  selected: null, hover: null, isolated: null, pvCyl: 0,
  scrubbing: false, wasRunning: false, firstRun: true, lastInteract: 0, camTw: null,
  pointer: new THREE.Vector2(), pointerPx: { x: 0, y: 0 }, needHover: false, down: null, dragging: false
};
const effSpeed = () => sim.speed * (sim.slow ? 0.2 : 1);
setSpeedSource(effSpeed);                   // M-02a: audio.fire() берёт текущую скорость отсюда
const raycaster = new THREE.Raycaster();
let pickables = [];
const el = {};

/* ---------- explode / steps ---------- */
function meanProgress() { return nodesList.reduce((a, n) => a + n.userData.progress, 0) / nodesList.length; }
function applyExplode() {
  for (const n of nodesList) {
    const ud = n.userData, t = clamp01(ud.progress);
    const e = Ease.inOutCubic(t) * 0.25 + t * 0.75;   // a touch of ease even for the raw slider value
    n.position.lerpVectors(ud.originalPosition, ud.explodedPosition, e);
    for (const lp of ud.localParts) lp.object.position.lerpVectors(lp.orig, lp.expl, e);
  }
}
function smoothExplode(dt) {
  if (ui.stepMode) return;
  const k = 1 - Math.exp(-dt * 9);
  for (const n of nodesList) {
    const ud = n.userData;
    ud.progress += (ui.explode - ud.progress) * k;
    if (Math.abs(ui.explode - ud.progress) < 0.0005) ud.progress = ui.explode;
  }
}
function killNodeTweens() { nodesList.forEach(n => { if (n.userData.tw) { n.userData.tw.kill(); n.userData.tw = null; } }); }
function exitStepMode() {
  if (!ui.stepMode) return;
  ui.stepMode = false;
  killNodeTweens();
  ui.explode = meanProgress();
  updateStepUI();
}
function animateExplode(v) {
  exitStepMode();
  if (ui.explodeTw) ui.explodeTw.kill();
  ui.explodeTw = tweenTo(ui, 'explode', v, { dur: 1.3, ease: Ease.inOutCubic, onComplete() { ui.explodeTw = null; } });
}
function gotoStep(i) {
  i = clamp(i, -1, STEPS.length - 1);
  if (ui.explodeTw) { ui.explodeTw.kill(); ui.explodeTw = null; }
  const prev = ui.stepMode ? ui.step : -1;
  ui.stepMode = true;
  ui.step = i;
  const targets = {};
  nodesList.forEach(n => {
    const ud = n.userData, target = ud.stepIndex <= i ? 1 : 0;
    targets[ud.key] = target;
    if (Math.abs(ud.progress - target) < 1e-3 && !ud.tw) return;
    if (ud.tw) ud.tw.kill();
    const order = target ? ud.stepIndex - Math.max(0, prev) : Math.max(0, prev) - ud.stepIndex;
    ud.tw = tweenTo(ud, 'progress', target, { dur: 0.95, delay: 0.07 * clamp(order, 0, 6), ease: Ease.inOutQuart, onComplete() { ud.tw = null; } });
  });
  updateStepUI();
  fitIfNeeded(boundsWith(targets));
}
function nextStep() { gotoStep(ui.stepMode ? ui.step + 1 : 0); }
function prevStep() { gotoStep(ui.stepMode ? ui.step - 1 : -1); }

/* bounds of the engine for a hypothetical set of node progress values */
function boundsWith(map) {
  const saved = nodesList.map(n => n.userData.progress);
  nodesList.forEach(n => { const k = n.userData.key; n.userData.progress = (typeof map === 'number') ? map : (map[k] ?? n.userData.progress); });
  applyExplode();
  engineRoot.updateMatrixWorld(true);
  const box = new THREE.Box3();
  nodesList.forEach(n => { if (!ui.isolated || ui.isolated === n) box.expandByObject(n); });
  nodesList.forEach((n, i) => { n.userData.progress = saved[i]; });
  applyExplode();
  engineRoot.updateMatrixWorld(true);
  return box;
}

/* ---------- camera ---------- */
function tweenCamera(pos, target, dur = 1.0, delay = 0) {
  if (ui.camTw) ui.camTw.kill();
  let p0, t0;
  ui.camTw = tween({ dur, delay, ease: Ease.inOutCubic,
    onStart() { p0 = camera.position.clone(); t0 = controls.target.clone(); },
    onUpdate(k) { camera.position.lerpVectors(p0, pos, k); controls.target.lerpVectors(t0, target, k); },
    onComplete() { ui.camTw = null; } });
}
function distFor(box, pad = 1.18) {
  const s = box.getBoundingSphere(new THREE.Sphere());
  const fov = camera.fov * DEG, fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
  return s.radius / Math.sin(Math.min(fov, fovH) / 2) * pad * 0.92;
}
function frameBox(box, dur = 1.2, delay = 0, dir = null) {
  const c = box.getCenter(new THREE.Vector3());
  const d = dir ? dir.clone().normalize() : camera.position.clone().sub(controls.target).normalize();
  tweenCamera(c.clone().addScaledVector(d, distFor(box)), c, dur, delay);
}
function fitIfNeeded(box) {
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(V3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const out = pts.some(p => { p.project(camera); return Math.abs(p.x) > 0.92 || Math.abs(p.y) > 0.9 || p.z > 1; });
  if (out) frameBox(box, 1.1, 0.1);
}
const CAM_DIRS = { front: V3(0, 0.16, 1), side: V3(1, 0.18, 0.05), top: V3(0.001, 1, 0.12), iso: CAM_HOME.clone().sub(TGT_HOME) };
function cameraPreset(name) {
  ui.lastInteract = performance.now();
  frameBox(boundsWith({}), 1.1, 0, CAM_DIRS[name]);
  document.querySelectorAll('#camRow .btn').forEach(b => b.classList.toggle('act', b.dataset.cam === name));
}
function resetView() { cameraPreset('iso'); }
function focusOn(node) {
  const box = new THREE.Box3().setFromObject(node);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = camera.position.clone().sub(controls.target).normalize();
  tweenCamera(c.clone().addScaledVector(dir, Math.max(r * 2.3, 2.6)), c, 1.0);
}

/* ---------- view modes ---------- */
const VIEW_NAMES = { solid: 'Сплошной', xray: 'Рентген', cut: 'Разрез' };
function setView(mode) {
  ui.view = mode;
  CAP.uCapOn.value = mode === 'cut' ? 1 : 0;
  cutPlane.constant = mode === 'cut' ? ui.cutZ : 100;
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('act', b.dataset.mode === mode));
  el.viewVal.textContent = VIEW_NAMES[mode];
  el.cutRow.classList.toggle('open', mode === 'cut');
  if (mode === 'cut' && camera.position.z - controls.target.z < 0.5) frameBox(boundsWith({}), 1.1, 0, V3(0.55, 0.32, 1));
}
function cycleView() { setView(ui.view === 'solid' ? 'xray' : ui.view === 'xray' ? 'cut' : 'solid'); }
function setCut(v) {
  ui.cutZ = -0.75 + 1.8 * v / 100;
  if (ui.view === 'cut') cutPlane.constant = ui.cutZ;
  el.cutSlider.style.setProperty('--p', v + '%');
  el.cutVal.textContent = Math.abs(ui.cutZ) < 0.05 ? 'по осям цилиндров' : (ui.cutZ > 0 ? '+' : '−') + Math.round(Math.abs(ui.cutZ) * 100) + ' мм от оси';
}

/* ---------- selection / hover / isolation ---------- */
function pick() {
  raycaster.setFromCamera(ui.pointer, camera);
  pickables.forEach(m => { if (m.isInstancedMesh) m.boundingSphere = null; });
  const hits = raycaster.intersectObjects(pickables, false);
  let glass = null;
  for (const h of hits) {
    const n = h.object.userData.node;
    if (!n || !h.object.visible) continue;
    if (ui.isolated && ui.isolated !== n) continue;
    const m = h.object.material;
    if (m.userData.housing && ui.view === 'cut' && h.point.z > cutPlane.constant) continue;   // clipped away
    if (n.userData.housing && ui.view === 'xray') { if (!glass) glass = n; continue; }
    return n;
  }
  return glass;
}
function select(node, focus = true) {
  ui.selected = node;
  if (node) { openInfo(node); if (focus) focusOn(node); } else closeInfo();
  Object.entries(el.chips).forEach(([k, c]) => c.classList.toggle('active', !!node && node.userData.key === k));
}
function isolate(node) {
  if (!node || ui.isolated === node) { ui.isolated = null; el.isoBar.classList.remove('on'); }
  else { ui.isolated = node; el.isoName.textContent = node.userData.info.short; el.isoBar.classList.add('on'); select(node, false); focusOn(node); }
  el.btnIsolate.textContent = ui.isolated && ui.isolated === ui.selected ? 'Показать всё' : 'Изолировать';
  Object.entries(el.chips).forEach(([k, c]) => c.classList.toggle('ghost', !!ui.isolated && ui.isolated.userData.key !== k));
  if (!ui.isolated) fitIfNeeded(boundsWith({}));
}
function setHover(n) {
  if (ui.hover === n) return;
  ui.hover = n;
  el.canvas.classList.toggle('pick', !!n);
  if (n) {
    el.tooltip.innerHTML = n.userData.info.name + '<i>клик — описание · двойной клик — изолировать</i>';
    el.tooltip.classList.add('on');
  } else el.tooltip.classList.remove('on');
}

/* ---------- info card ---------- */
let liveTimer = 0;
function openInfo(node) {
  const info = node.userData.info;
  el.infoTag.textContent = info.tag;
  el.infoTitle.textContent = info.name;
  el.infoDesc.textContent = info.desc;
  el.infoSpecs.textContent = '';
  info.specs.forEach(([k, v]) => el.infoSpecs.insertAdjacentHTML('beforeend', `<div class="spec"><span>${k}</span><b>${v}</b></div>`));
  if (info.specs.some(([, v]) => v.includes('*'))) el.infoSpecs.insertAdjacentHTML('beforeend', '<div class="spec"><span>* иллюстративное значение</span></div>');
  el.infoSpecs.insertAdjacentHTML('beforeend', '<div class="spec"><span>Учебная модель: справочные значения иллюстративные</span></div>');
  el.btnIsolate.textContent = ui.isolated === node ? 'Показать всё' : 'Изолировать';
  updateLive(true);
  el.infocard.classList.add('open');
  layoutPanels();
}
function closeInfo() { el.infocard.classList.remove('open'); el.infoLive.textContent = ''; layoutPanels(); }
function liveRows(key) {
  const c = ui.pvCyl, phi = phaseOf(c), st = STROKES[strokeOf(phi)].name;
  const rpm = Math.round(effSpeed() * BASE_RPM * (sim.running ? 1 : 0));
  const xmm = (PIN_TDC - sim.pistonY[c]) * 100;   // мм от ВМТ, 0…72: 1 ед. = 100 мм (D-05)
  switch (key) {
    case 'crankshaft': return [['Угол поворота', Math.round(mod(sim.theta / DEG, 360)) + '°'], ['Угол в цикле', Math.round(cycDeg()) + '° из 720°'], ['Обороты модели', rpm + ' об/мин']];
    case 'pistons': return [[`Цилиндр ${c + 1}`, st], ['От ВМТ', xmm.toFixed(1) + ' мм'], ['Давление над поршнем', pressureAt(phi).toFixed(1) + ' бар']];
    case 'rods': { const a = Math.asin(CRANK_R * Math.sin((sim.theta - FIRE_DEG[c] * DEG)) / ROD_L) / DEG; return [[`Наклон шатуна, ц. ${c + 1}`, a.toFixed(1) + '°'], ['Такт', st]]; }
    case 'valvetrain': return [[`Впускные, ц. ${c + 1}`, (sim.intakeLift[c] * CAM_LIFT * 100).toFixed(1) + ' мм'], [`Выпускные, ц. ${c + 1}`, (sim.exhaustLift[c] * CAM_LIFT * 100).toFixed(1) + ' мм'], ['Угол распредвала', Math.round(mod(sim.theta / DEG / 2, 360)) + '°']];
    case 'sparks': { let best = 1e9, who = 0; for (let i = 0; i < 4; i++) { const d = mod(FIRE_DEG[i] - SPARK_ADV - cycDeg(), 720); if (d < best) { best = d; who = i; } } return [['Следующая искра', `цилиндр ${who + 1}`], ['Через', Math.round(best) + '° поворота']]; }
    case 'intake': { const open = [0, 1, 2, 3].filter(i => sim.intakeLift[i] > 0.02).map(i => i + 1); return [['Открыт впуск', open.length ? 'ц. ' + open.join(', ') : '—'], ['Давление на впуске (модель)', '0,92 бар']]; }
    case 'exhaust': { const open = [0, 1, 2, 3].filter(i => sim.exhaustLift[i] > 0.02).map(i => i + 1); return [['Открыт выпуск', open.length ? 'ц. ' + open.join(', ') : '—'], ['Нагрев (модель)', Math.round(180 + sim.heat * 720) + ' °C']]; }
    case 'head': return [[`Камера ц. ${c + 1}`, st], ['Давление', pressureAt(phi).toFixed(1) + ' бар'], ['Объём', volumeAt(phi).toFixed(0) + ' см³']];
    case 'belt': return [['Распредвалы', Math.round(mod(sim.theta / DEG / 2, 360)) + '° (½ коленвала)'], ['Ролик', 'вращается ×' + (R_CRANK_SPR / IDLER.r).toFixed(2)]];
    case 'block': return [0, 1, 2, 3].map(i => [`Цилиндр ${i + 1}`, STROKES[strokeOf(phaseOf(i))].name]);
  }
  return [];
}
function updateLive(force) {
  if (!ui.selected || !el.infocard.classList.contains('open')) return;
  const now = performance.now();
  if (!force && now - liveTimer < 120) return;
  liveTimer = now;
  const rows = liveRows(ui.selected.userData.key);
  el.infoLive.innerHTML = rows.length ? '<div class="ttl">Сейчас</div>' + rows.map(([k, v]) => `<div class="spec"><span>${k}</span><b>${v}</b></div>`).join('') : '';
}

/* ---------- HUD charts (canvas 2D) ---------- */
const charts = { dpr: 1, pvBg: null, trail: [] };
function sizeCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth || 288, h = +c.getAttribute('height');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px';
  return { w, h, dpr };
}
function setupCharts() {
  charts.t = sizeCanvas(el.timing);
  charts.p = sizeCanvas(el.pv);
  charts.pvBg = null;
}
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

/* ---------- labels ---------- */
const labelEls = new Map();
function buildLabels() {
  nodesList.forEach(n => {
    const d = document.createElement('div');
    d.className = 'lbl';
    d.innerHTML = `<span>${n.userData.info.short}</span><i></i>`;
    d.style.opacity = 0;
    d.querySelector('span').addEventListener('click', () => select(n));
    el.labels.appendChild(d);
    labelEls.set(n, d);
  });
}
const _a = new THREE.Vector3();
function updateLabels() {
  const W = innerWidth, H = innerHeight;
  labelEls.forEach((d, n) => {
    const visible = ui.labels && n.userData.opacity > 0.3 && n.visible;
    if (!visible) { if (d.style.opacity !== '0') d.style.opacity = 0; return; }
    _a.copy(n.userData.anchor);
    n.localToWorld(_a);
    _a.project(camera);
    if (_a.z > 1) { d.style.opacity = 0; return; }
    const x = (_a.x * 0.5 + 0.5) * W, y = (-_a.y * 0.5 + 0.5) * H;
    d.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    d.style.opacity = 1;
    d.classList.toggle('hl', ui.hover === n);
    d.classList.toggle('sel', ui.selected === n);
  });
}

/* ---------- per-node materials: ghosting, x-ray, glow, exhaust heat ---------- */
const HL_HOVER = new THREE.Color(0x2c7dff), HL_SEL = new THREE.Color(0xff9a2e), HEAT = new THREE.Color(1.0, 0.30, 0.07);
const _gc = new THREE.Color();
function updateMaterials(dt) {
  const k = 1 - Math.exp(-dt * 10), kg = 1 - Math.exp(-dt * 14);
  for (const n of nodesList) {
    const ud = n.userData;
    let o = 1;
    if (ud.housing && ui.view === 'xray') o = 0.13;
    if (ui.isolated && ui.isolated !== n) o = Math.min(o, 0.05);
    ud.opacity += (o - ud.opacity) * k;
    if (Math.abs(o - ud.opacity) < 0.002) ud.opacity = o;
    let gt = 0;
    if (ui.selected === n) { gt = ui.hover === n ? 0.45 : 0.2; ud.glowColor.copy(HL_SEL); }
    else if (ui.hover === n) { gt = 0.5; ud.glowColor.copy(HL_HOVER); }
    ud.glow += (gt - ud.glow) * kg;
    if (Math.abs(gt - ud.glow) < 0.002) ud.glow = gt;
    n.visible = ud.opacity > 0.015;
    for (const m of ud.mats.values()) {
      const op = m.userData.baseOpacity * ud.opacity;
      const tr = op < 0.995;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op;
      m.depthWrite = !tr;
      _gc.copy(m.userData.baseEmissive);
      if (m.userData.isPipe) { const h = sim.heat * 1.5 * fx.exhaust; _gc.r += HEAT.r * h; _gc.g += HEAT.g * h; _gc.b += HEAT.b * h; }
      _gc.r += ud.glowColor.r * ud.glow; _gc.g += ud.glowColor.g * ud.glow; _gc.b += ud.glowColor.b * ud.glow;
      m.emissive.copy(_gc);
    }
  }
}

/* ---------- step UI / sliders ---------- */
function setRange(r, v, pct) { if (document.activeElement !== r || !ui.scrubbing) r.value = v; r.style.setProperty('--p', pct + '%'); }
function updateStepUI() {
  el.stepDots.textContent = '';
  STEPS.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'dot' + (ui.stepMode && i < ui.step ? ' done' : '') + (ui.stepMode && i === ui.step ? ' now' : '');
    d.title = (i + 1) + '. ' + s.title;
    d.addEventListener('click', () => gotoStep(i));
    el.stepDots.appendChild(d);
  });
  if (ui.stepMode && ui.step >= 0) {
    const s = STEPS[ui.step];
    el.stepCount.textContent = 'ШАГ ' + (ui.step + 1) + ' / ' + STEPS.length;
    el.stepTitle.innerHTML = '<span>' + (ui.step + 1) + '.</span> ' + s.title;
    el.stepNote.textContent = s.note;
  } else {
    el.stepCount.textContent = ui.stepMode ? 'ШАГ 0 / ' + STEPS.length : 'ПО ШАГАМ';
    el.stepTitle.textContent = 'Двигатель собран';
    el.stepNote.innerHTML = 'Нажмите <b>Далее</b>: свечи → ремень ГРМ → распредвалы → коллекторы → ГБЦ → блок → поршни → коленвал.';
  }
  el.btnPrev.disabled = !ui.stepMode || ui.step < 0;
  el.btnNext.disabled = ui.stepMode && ui.step >= STEPS.length - 1;
}
function speedFromSlider(v) { return 0.05 * Math.pow(200, v / 100); }
function updateSpeedUI() {
  const v = +el.speedSlider.value;
  sim.speed = speedFromSlider(v);
  el.speedSlider.style.setProperty('--p', v + '%');
  const e = effSpeed();
  el.speedVal.textContent = '×' + (e < 1 ? e.toFixed(2) : e.toFixed(1)) + ' · ' + (e * BASE_RPM < 10 ? (e * BASE_RPM).toFixed(1) : Math.round(e * BASE_RPM)) + ' об/мин';
}
function setRunning(v) {
  sim.running = v;
  el.btnRun.classList.toggle('on', v);
  el.btnRun.classList.toggle('accent', !v);
  el.btnRun.innerHTML = v ? '⏸ Пауза <kbd>Space</kbd>' : '▶ Запустить <kbd>Space</kbd>';
}
function toggleRun() {
  setRunning(!sim.running);
  if (sim.running) {
    audio.update(true, effSpeed());
    if (ui.firstRun && ui.view === 'solid') { setView('cut'); toast('Включил разрез, чтобы были видны такты. Вид меняется клавишей X'); }
    else if (meanProgress() > 0.15) toast('Механизм крутится и в разборке, а горение видно только в собранном двигателе');
    ui.firstRun = false;
  }
}
function nudgeCrank(deg) {
  if (sim.running) setRunning(false);
  sim.theta += deg * DEG;
}
let toastTimer = 0;
function toast(msg, ms = 3800) {
  el.toast.textContent = msg;
  el.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('on'), ms);
}
function togglePanels(force) {
  const hide = force !== undefined ? force : !(el.hud.classList.contains('hid') && el.cycle.classList.contains('hid'));
  setPanel(el.hud, el.hudOpen, hide); setPanel(el.cycle, el.cycleOpen, hide);
}
function setPanel(p, btn, hide) { p.classList.toggle('hid', hide); btn.classList.toggle('on', hide); layoutPanels(); }
function layoutPanels() {
  if (innerWidth <= 760) { el.cycle.classList.remove('compact'); return; }
  el.cycle.classList.remove('compact');
  if (!el.infocard.classList.contains('open') || el.cycle.classList.contains('hid')) return;
  const natural = el.cycle.scrollHeight - el.pvWrap.clientHeight + el.pvWrap.scrollHeight + 16, cardTop = innerHeight - 16 - el.infocard.offsetHeight;
  if (natural > cardTop - 10) el.cycle.classList.add('compact');
}
function setToggle(btn, on) { btn.classList.toggle('act', on); }
function screenshot() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const d = new Date(), z = n => String(n).padStart(2, '0');
  a.download = `dvigatel-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.png`;
  a.href = url;
  document.body.appendChild(a); a.click(); a.remove();
  el.flash.style.transition = 'none'; el.flash.style.opacity = 0.55;
  requestAnimationFrame(() => { el.flash.style.transition = 'opacity .45s'; el.flash.style.opacity = 0; });
  toast('Снимок сохранён: ' + a.download, 2600);
}

function initUI() {
  ['explodeSlider', 'explodeVal', 'btnAssemble', 'btnExplode', 'stepDots', 'stepCount', 'stepTitle', 'stepNote', 'btnPrev', 'btnNext',
   'viewVal', 'cutRow', 'cutSlider', 'cutVal', 'btnLabels', 'btnRotate', 'btnSound', 'btnShot', 'partChips', 'partCount',
   'hud', 'hudHide', 'hudOpen', 'cycle', 'cycleHide', 'cycleOpen', 'fps', 'btnRun', 'btnSlow', 'speedSlider', 'speedVal',
   'angleSlider', 'angleVal', 'btnDegBack', 'btnDegFwd', 'timing', 'pv', 'pvTitle', 'pvVal', 'pvWrap',
   'infocard', 'infoClose', 'infoTag', 'infoTitle', 'infoDesc', 'infoSpecs', 'infoLive', 'btnFocus', 'btnIsolate',
   'isoBar', 'isoName', 'btnUnIso', 'toast', 'flash', 'help', 'helpClose', 'helpLink', 'labels', 'tooltip'].forEach(id => { el[id] = $(id); });
  el.canvas = renderer.domElement;
  el.fireChips = Array.from(document.querySelectorAll('.fire .c'));

  // buttons never keep focus (so Space never double-triggers a focused button)
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); }, { signal: life.signal });

  el.explodeSlider.addEventListener('input', () => {
    exitStepMode();
    if (ui.explodeTw) { ui.explodeTw.kill(); ui.explodeTw = null; }
    ui.explode = el.explodeSlider.value / 100;
  });
  el.explodeSlider.addEventListener('change', () => el.explodeSlider.blur());
  el.btnAssemble.addEventListener('click', () => { animateExplode(0); frameBox(boundsWith(0), 1.2, 0.15); });
  el.btnExplode.addEventListener('click', () => { animateExplode(1); frameBox(boundsWith(1), 1.35, 0.25); });
  el.btnPrev.addEventListener('click', prevStep);
  el.btnNext.addEventListener('click', nextStep);

  document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
  el.cutSlider.addEventListener('input', () => setCut(+el.cutSlider.value));
  el.cutSlider.addEventListener('change', () => el.cutSlider.blur());
  setCut(+el.cutSlider.value);
  document.querySelectorAll('#camRow .btn').forEach(b => b.addEventListener('click', () => cameraPreset(b.dataset.cam)));
  el.btnLabels.addEventListener('click', () => { ui.labels = !ui.labels; setToggle(el.btnLabels, ui.labels); });
  el.btnRotate.addEventListener('click', () => { ui.autoRotate = !ui.autoRotate; setToggle(el.btnRotate, ui.autoRotate); ui.lastInteract = 0; });
  el.btnSound.addEventListener('click', toggleSound);
  el.btnShot.addEventListener('click', screenshot);

  // chips
  nodesList.forEach(n => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = n.userData.info.short;
    c.title = n.userData.info.name;
    c.addEventListener('click', () => select(ui.selected === n ? null : n));
    c.addEventListener('dblclick', () => isolate(n));
    el.partChips.appendChild(c);
    (el.chips = el.chips || {})[n.userData.key] = c;
  });
  el.partCount.textContent = nodesList.length + ' узлов';

  // panels
  el.hudHide.addEventListener('click', () => setPanel(el.hud, el.hudOpen, true));
  el.hudOpen.addEventListener('click', () => setPanel(el.hud, el.hudOpen, false));
  el.cycleHide.addEventListener('click', () => setPanel(el.cycle, el.cycleOpen, true));
  el.cycleOpen.addEventListener('click', () => setPanel(el.cycle, el.cycleOpen, false));
  el.helpLink.addEventListener('click', () => el.help.classList.add('on'));
  el.helpClose.addEventListener('click', () => el.help.classList.remove('on'));

  // engine controls
  el.btnRun.addEventListener('click', toggleRun);
  el.btnSlow.addEventListener('click', () => { sim.slow = !sim.slow; setToggle(el.btnSlow, sim.slow); updateSpeedUI(); });
  el.speedSlider.addEventListener('input', updateSpeedUI);
  el.speedSlider.addEventListener('change', () => el.speedSlider.blur());
  updateSpeedUI();
  const startScrub = () => { if (ui.scrubbing) return; ui.scrubbing = true; ui.wasRunning = sim.running; if (sim.running) setRunning(false); };
  const endScrub = () => { if (!ui.scrubbing) return; ui.scrubbing = false; if (ui.wasRunning) setRunning(true); el.angleSlider.blur(); };
  el.angleSlider.addEventListener('pointerdown', startScrub);
  el.angleSlider.addEventListener('input', () => {
    if (!ui.scrubbing) { startScrub(); ui.scrubbing = 'key'; }
    const base = Math.floor(sim.theta / DEG / 720) * 720;
    sim.theta = (base + +el.angleSlider.value) * DEG;
  });
  el.angleSlider.addEventListener('change', endScrub);
  window.addEventListener('pointerup', endScrub, { signal: life.signal });
  const holdRepeat = (btn, sign) => {
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => {
      const step = (e.shiftKey ? 1 : 5) * sign;
      nudgeCrank(step);
      stop();
      t1 = setTimeout(() => { t2 = setInterval(() => nudgeCrank(step), 45); }, 320);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
  };
  holdRepeat(el.btnDegBack, -1);
  holdRepeat(el.btnDegFwd, 1);
  el.timing.addEventListener('click', e => {
    const r = el.timing.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top - TL.top) / TL.row);
    if (i >= 0 && i < 4) setPvCyl(i);
  });
  el.fireChips.forEach(c => c.addEventListener('click', () => setPvCyl(+c.dataset.c)));

  // info card
  el.infoClose.addEventListener('click', () => select(null, false));
  el.btnFocus.addEventListener('click', () => ui.selected && focusOn(ui.selected));
  el.btnIsolate.addEventListener('click', () => isolate(ui.isolated === ui.selected ? null : ui.selected));
  el.btnUnIso.addEventListener('click', () => isolate(null));

  // pointer: hover, click vs drag, double-click isolate
  const cv = el.canvas;
  const setPtr = e => {
    const r = cv.getBoundingClientRect();
    ui.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ui.pointerPx.x = e.clientX; ui.pointerPx.y = e.clientY;
  };
  cv.addEventListener('pointermove', e => {
    setPtr(e);
    el.tooltip.style.left = e.clientX + 'px'; el.tooltip.style.top = e.clientY + 'px';
    if (ui.down && Math.hypot(e.clientX - ui.down.x, e.clientY - ui.down.y) > 5) ui.dragging = true;
    ui.needHover = !ui.dragging;
    if (ui.dragging) setHover(null);
  });
  cv.addEventListener('pointerleave', () => { ui.needHover = false; setHover(null); });
  cv.addEventListener('pointerdown', e => {
    ui.down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    ui.dragging = false;
    ui.lastInteract = performance.now();
    cv.focus({ preventScroll: true });
  });
  cv.addEventListener('pointerup', e => {
    const d = ui.down; ui.down = null;
    if (!d || d.button !== 0) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 5 || performance.now() - d.t > 600) { ui.dragging = false; return; }
    setPtr(e);
    const n = pick();
    if (n !== ui.selected || !n) select(n);
  });
  cv.addEventListener('dblclick', e => {
    setPtr(e);
    const n = pick();
    if (n) isolate(n); else if (ui.isolated) isolate(null);
  });
  controls.addEventListener('start', () => { if (ui.camTw) { ui.camTw.kill(); ui.camTw = null; } ui.lastInteract = performance.now(); });
  cv.addEventListener('wheel', () => { if (ui.camTw) { ui.camTw.kill(); ui.camTw = null; } ui.lastInteract = performance.now(); }, { passive: true });

  window.addEventListener('keydown', onKey, { signal: life.signal });
  window.addEventListener('resize', onResize, { signal: life.signal });
  updateStepUI();
  buildLabels();
  setupCharts();
}
function setPvCyl(i) {
  ui.pvCyl = i;
  el.pvTitle.textContent = 'p–V диаграмма · цилиндр ' + (i + 1);
  updateLive(true);
}
function toggleSound() {
  const want = !audio.on;
  if (!audio.setOn(want)) { toast('Браузер не поддерживает WebAudio'); return; }
  setToggle(el.btnSound, want);
  if (want) toast(sim.running ? 'Звук включён: каждый «хлопок» — рабочий ход' : 'Звук включён — запустите двигатель (Space)');
}
function onKey(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' && /^Arrow/.test(e.key)) return;     // let a focused slider use the arrows
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  ui.lastInteract = performance.now();
  if (k === ' ') { toggleRun(); e.preventDefault(); }
  else if (k === 'ArrowRight') { nextStep(); e.preventDefault(); }
  else if (k === 'ArrowLeft') { prevStep(); e.preventDefault(); }
  else if (k === ',' || k === '<' || k === 'б' || k === 'Б') nudgeCrank(e.shiftKey ? -1 : -5);
  else if (k === '.' || k === '>' || k === 'ю' || k === 'Ю') nudgeCrank(e.shiftKey ? 1 : 5);
  else if (k === '+' || k === '=') { el.speedSlider.value = Math.min(100, +el.speedSlider.value + 5); updateSpeedUI(); }
  else if (k === '-' || k === '_') { el.speedSlider.value = Math.max(0, +el.speedSlider.value - 5); updateSpeedUI(); }
  else if (k === 'Escape') {
    if (el.help.classList.contains('on')) el.help.classList.remove('on');
    else if (ui.isolated) isolate(null);
    else if (ui.selected) select(null, false);
  }
  else if (k === '?') el.help.classList.toggle('on');
  else if (/^[1-4]$/.test(k)) cameraPreset(['front', 'side', 'top', 'iso'][+k - 1]);
  else {
    const code = e.code;   // layout-independent (works with the Russian layout too)
    if (code === 'KeyR') resetView();
    else if (code === 'KeyE') { if (meanProgress() > 0.5) el.btnAssemble.click(); else el.btnExplode.click(); }
    else if (code === 'KeyX') cycleView();
    else if (code === 'KeyL') el.btnLabels.click();
    else if (code === 'KeyA') el.btnRotate.click();
    else if (code === 'KeyM') toggleSound();
    else if (code === 'KeyS') el.btnSlow.click();
    else if (code === 'KeyP') screenshot();
    else if (code === 'KeyH') togglePanels();
    else if (code === 'KeyF') { if (ui.selected) focusOn(ui.selected); }
    else if (code === 'KeyI') { if (ui.selected) isolate(ui.isolated === ui.selected ? null : ui.selected); }
    else if (code === 'Slash' && e.shiftKey) el.help.classList.toggle('on');
  }
}
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  [inPts, exPts].forEach(P => { P.points.material.uniforms.uScale.value = innerHeight * pixelRatio * 0.5; });
  setupCharts();
  layoutPanels();
}

/* ----------------------------------------------------------------------------
 * 11. ЦИКЛ РЕНДЕРА
 * ------------------------------------------------------------------------- */
const perf = { frames: 0, t0: performance.now(), fps: 60, good: 0, adaptive: !params.has('noadapt') };
let lastTheta = 0;
function adapt() {
  perf.frames++;
  const now = performance.now(), el_ = (now - perf.t0) / 1000;
  if (el_ < 1) return;
  perf.fps = perf.frames / el_;
  perf.frames = 0; perf.t0 = now;
  if (perf.adaptive && !document.hidden) {
    let pr = pixelRatio;
    if (perf.fps < 46 && pr > 1) { pr = Math.max(1, pr - 0.25); perf.good = 0; }
    else if (perf.fps > 58) { if (++perf.good >= 4 && pr < MAX_PR) { pr = Math.min(MAX_PR, pr + 0.25); perf.good = 0; } }
    else perf.good = 0;
    if (pr !== pixelRatio) {
      storePixelRatio(pr);                  // M-02b: pixelRatio объявлен в render/scene.js
      renderer.setPixelRatio(pr);
      onResize();
    }
  }
  el.fps.textContent = Math.round(perf.fps) + ' fps · ' + pixelRatio.toFixed(2).replace(/0$/, '') + '×';
}
function frame(dt) {
  updateTweens(dt);
  if (sim.running) sim.theta += effSpeed() * BASE_RPM / 60 * Math.PI * 2 * dt;
  const dPhi = clamp((sim.theta - lastTheta) / DEG, -90, 90);
  lastTheta = sim.theta;
  updateKinematics();
  smoothExplode(dt);
  applyExplode();
  updateMaterials(dt);
  updateEffects(dt, dPhi);
  audio.update(sim.running, effSpeed());

  if (ui.needHover) { ui.needHover = false; setHover(pick()); }
  controls.autoRotate = ui.autoRotate && !ui.camTw && performance.now() - ui.lastInteract > 2500;
  controls.update();

  // HUD
  const cd = cycDeg();
  if (!ui.scrubbing) setRange(el.angleSlider, Math.round(cd), cd / 7.2);
  else el.angleSlider.style.setProperty('--p', (+el.angleSlider.value / 7.2) + '%');
  el.angleVal.textContent = `${Math.round(mod(sim.theta / DEG, 360))}° · цикл ${Math.round(cd)}°`;
  const mp = meanProgress(), pct = Math.round(mp * 100);
  if (document.activeElement !== el.explodeSlider || ui.stepMode) setRange(el.explodeSlider, pct, pct);
  el.explodeVal.textContent = pct + '%';
  for (const c of el.fireChips) { const phi = phaseOf(+c.dataset.c); c.classList.toggle('hot', phi < 90 || phi > 720 - SPARK_ADV); }
  if (!el.cycle.classList.contains('hid')) { drawTiming(); if (!el.cycle.classList.contains('compact') && innerWidth > 760) drawPV(); }
  updateLive(false);
  updateLabels();

  renderer.render(scene, camera);
  adapt();
}
function loop() {
  if (run.stopped) return;
  run.raf = requestAnimationFrame(loop);
  if (run.lost) return;                     // M-03: пауза, пока WebGL-контекст потерян
  try {
    frame(Math.min(clock.getDelta(), 0.05));
    run.errors = 0;
  } catch (err) {                           // M-03: ошибку кадра сообщаем один раз; если повторяется — останавливаем цикл
    if (++run.errors === 1) console.error(err);
    if (run.errors >= 30) {
      stopLoop();
      window.__engScreen('failed', '<b>3D-модель остановлена из-за ошибки.</b><br>' +
        window.__engEsc(err && err.message ? err.message : err) + '<br>Перезагрузите страницу.', ['reload']);
    }
  }
}

/* ----------------------------------------------------------------------------
 * M-03. ПОТЕРЯ WEBGL-КОНТЕКСТА, ОСТАНОВКА, DISPOSE
 * После restore three.js сам заново загружает геометрии, материалы, canvas-текстуры и карты теней;
 * окружение (PMREM) — результат рендера, его строим заново.
 * ------------------------------------------------------------------------- */
const run = { raf: 0, stopped: false, disposed: false, lost: false, errors: 0, timer: 0 };
const life = new AbortController();         // снимает слушатели window/document в dispose()
setLifecycle(life, onContextLost, onContextRestored);   // M-02b: initScene() из render/scene.js вешает их с life.signal
function stopLoop() { run.stopped = true; cancelAnimationFrame(run.raf); }
function onContextLost() {
  if (run.stopped) return;                  // после остановки сообщение об ошибке остаётся на экране
  run.lost = true;
  window.__engScreen('lost', 'Графика временно недоступна: браузер сбросил WebGL-контекст. Восстанавливаю…');
  clearTimeout(run.timer);
  run.timer = setTimeout(() => window.__engScreen('failed', '<b>Не удалось восстановить графику.</b><br>' +
    'Браузер не вернул WebGL-контекст. Перезагрузите страницу.', ['reload']), 10000);
}
function onContextRestored() {
  clearTimeout(run.timer);
  scene.environment = makeEnvironment();
  run.lost = false;
  if (window.__engOk && !run.stopped) window.__engScreen('ready');
}
function dispose() {
  if (run.disposed) return;
  run.disposed = true;
  stopLoop();
  clearTimeout(run.timer);
  life.abort();
  controls.dispose();
  const res = new Set([scene.background, envTarget]);
  [scene, envRoom].forEach(root => root.traverse(o => {
    if (o.isInstancedMesh) res.add(o);
    if (o.geometry) res.add(o.geometry);
    for (const m of [].concat(o.material || [])) {
      res.add(m);
      for (const v of Object.values(m).concat(Object.values(m.uniforms || {}).map(u => u.value))) if (v && v.isTexture) res.add(v);
    }
    if (o.shadow && o.shadow.map) res.add(o.shadow);
  }));
  res.forEach(r => r && r.dispose());
  if (audio.ctx) audio.ctx.close();
  renderer.dispose();
  renderer.forceContextLoss();              // внутренние объекты three.js (фон, материалы теней) уходят вместе с контекстом
}

/* ----------------------------------------------------------------------------
 * ЗАПУСК
 * ------------------------------------------------------------------------- */
function boot() {
  initScene();
  buildEngine();
  buildEffects();
  nodesList.forEach(n => n.traverse(o => { if (o.isMesh) pickables.push(o); }));
  sim.theta = 25 * DEG;
  lastTheta = sim.theta;
  initUI();
  // intro: fly in from afar
  const dir = CAM_HOME.clone().sub(TGT_HOME).normalize();
  camera.position.copy(TGT_HOME).addScaledVector(dir, 34);
  controls.update();
  frame(0.016);
  window.__engOk = true;
  if (!run.lost) window.__engScreen('ready');
  tweenCamera(CAM_HOME.clone(), TGT_HOME.clone(), 2.3, 0.1);
  setTimeout(() => toast('Клик по детали — описание · Space — запуск · ? — все клавиши', 5200), 1600);
  loop();
}
// test hooks (used by the automated browser check; harmless for users)
window.engine = {
  sim, ui, nodes, get renderer() { return renderer; }, get camera() { return camera; }, get controls() { return controls; },
  setView, toggleRun, setRunning, gotoStep, cameraPreset, select: k => select(k ? nodes[k] : null), isolate: k => isolate(k ? nodes[k] : null),
  setTheta: d => { sim.theta = d * DEG; }, phaseOf, pressureAt, frame, toggleLabels: () => el.btnLabels.click(),
  explode: v => animateExplode(v), dispose, busy: () => tweens.size + (meanProgress() !== Math.round(meanProgress()) && !ui.stepMode ? 1 : 0), meanProgress, stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures })
};
try { boot(); }
catch (err) { console.error(err); window.__engFail('Ошибка при сборке сцены: ' + window.__engEsc(err && err.message ? err.message : err), ['reload']); }
