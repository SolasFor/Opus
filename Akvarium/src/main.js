/**
 * Akvarium — точка входа (A-01b): корм, состояние K и пресеты, симуляция рыб, взаимодействие, звук,
 * покадровые обновления, камера, панель, ввод, цикл кадров, адаптивное разрешение, потеря контекста,
 * window.__aqAPI.
 * Тело — строки 1187–1962 модуля однофайловой Aquarium.html (D-13), перенесены дословно; швы — tests/split.test.js.
 * Швы: pixelRatio = … → storePixelRatio(…), ENV = makeEnv() → storeEnv(makeEnv()).
 * A-02 (телефон, касание, доступность, D-12): жесты — ui/gestures.js, шторка — ui/sheet.js, строки и числа ru-RU —
 * ui/strings.ru.js; здесь — весь аквариум в кадре на узком экране (camK), сдвиг кадра над шторкой, reduced motion,
 * переключатель «Медузы», имена и состояния элементов для экранного диктора, правило Space/Enter, порядок Esc.
 * A-04: голод и сытость рыб — sim/hunger.js; здесь только связка.
 * A-04, шаг 2: ночной отдых и укрытия — sim/rest.js, параметры обеих моделей — config/ecosystem.js, подпись — ui/strings.ru.js.
 */
import * as THREE from 'three';
import { applyLimits, CAM_HOME, camera, clamp, controls, D, fill, hemi, HS, HT, LIM, MAXPR, pixelRatio, renderer, rnd, rr, scene, smooth, storePixelRatio, sun, TGT_HOME, torch, U, W } from './core.js';
import { AERATOR, ANEM_STARTLE, ANEMONES, lampMat, ripple, sandH } from './scenery.js';
import { anthias, bub, BUB_N, bubbles, chromis, clowns, ENV, FISH_MATS, idols, jellies, makeEnv, SPECIES, storeEnv, tangs, ytang } from './creatures.js';
import { ADAPT, ADAPT0, adaptStep } from './adapt.js';
import { REST } from './config/ecosystem.js';
import { foodBoost, foodReach, hungerBite, hungerCopy, hungerInit, hungerStep, remainsAge, remainsCut, remainsGone, remainsScale } from './sim/hunger.js';
import { homeSpread, restAttractor, restWeight, shelterSide, shelterTop, speedHi } from './sim/rest.js';
import { BEHAVIOR_NOTE, FMT, JELLY_NOTE, JELLY_TIP, PANEL_HTML, S, SLIDERS, TOGGLES, VALUETEXT } from './ui/strings.ru.js';
import { KIND, createGestures } from './ui/gestures.js';
import { initSheet, setStop, SHEET } from './ui/sheet.js';

// ------------------------------------------------------------------ food: flakes float, sink, settle on the sand; each flake takes a few bites
const FOOD_N = 160;
const foodG = new THREE.BufferGeometry(); const foodArr = new Float32Array(FOOD_N * 3).fill(-999), foodSz = new Float32Array(FOOD_N);
foodG.setAttribute('position', new THREE.BufferAttribute(foodArr, 3));
foodG.setAttribute('aSz', new THREE.BufferAttribute(foodSz, 1));
const foodPts = new THREE.Points(foodG, new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: `uniform float uPR; attribute float aSz; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPR * 75.0 * aSz / -mv.z; }`,
  fragmentShader: `uniform float uNight; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(0.95, 0.5, 0.2) * (1.15 - d) * (1.0 - 0.6 * uNight), 1.0); }`
}));
foodPts.frustumCulled = false; scene.add(foodPts);
const food = [];
for (let i = 0; i < FOOD_N; i++) food.push({ p: new THREE.Vector3(0, -999, 0), alive: false, t: 0, ph: rnd() * 6.28, hp: 0, ground: 0, rippled: false });
let foodCursor = 0, foodAlive = 0, foodGround = 0;
const groundAges = new Float32Array(FOOD_N);   // A-04 step 3: ages of flakes lying on the sand, refilled every frame
function dropFood(x, z, n = 12, spread = 0.6) {
  x = clamp(x, -W / 2 + 0.5, W / 2 - 0.5); z = clamp(z, -D / 2 + 0.5, D / 2 - 0.5);
  for (let i = 0; i < n; i++) {
    const f = food[foodCursor]; foodCursor = (foodCursor + 1) % FOOD_N;
    f.p.set(clamp(x + rr(-spread, spread), -W / 2 + 0.3, W / 2 - 0.3), HS - 0.05, clamp(z + rr(-spread * 0.8, spread * 0.8), -D / 2 + 0.3, D / 2 - 0.3));
    f.alive = true; f.t = rr(0, 0.8); f.ph = rnd() * 6.28; f.hp = 3; f.ground = 0;
  }
  ripple(x, z, 0.05 + 0.004 * n); window.__aqDrops = (window.__aqDrops || 0) + 1;
}

// ------------------------------------------------------------------ state (everything the control panel drives)
const K = { night: 0, warm: 0, cur: 0.6, turb: 0.3, spd: 1, pop: 0.6, air: true, auto: true, free: false, follow: false, torch: true, flee: true, sound: false, jelly: true };
// A-02: prefers-reduced-motion — без пролёта камеры при запуске, тряски от стука, вспышки снимка и зерна (styles/app.css);
// автокамера выключена при запуске. Читается в момент действия: настройку можно менять без перезагрузки
const RM = matchMedia('(prefers-reduced-motion: reduce)');
if (RM.matches) K.auto = false;
const PRESETS = { day: { night: 0, warm: 0 }, sunset: { night: 0.22, warm: 1 }, night: { night: 1, warm: 0 } };
let tween = null, preset = 'day';

// ------------------------------------------------------------------ fish simulation (allocation-free per frame)
const OBST = [[-3.6, 1.2, -2.0, 2.5], [-3.3, 3.1, -2.5, 1.4], [-4.6, 2.2, -2.2, 1.3], [4.1, 1.0, -2.2, 2.1], [4.9, 2.0, -2.5, 1.3], [0.6, 0.3, -0.4, 1.2], [-2.0, 3.4, -1.9, 0.9]];
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), ACC = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Vector3();
const ATT = new THREE.Vector3(), MAT = new THREE.Matrix4(), SCL = new THREE.Vector3();
const BIGS = [...tangs.fish, ...ytang.fish, ...idols.fish];
const ANEM0 = ANEMONES[0], HIDE_P = new THREE.Vector3(ANEM0.x, ANEM0.y + 0.42, ANEM0.z);
const mouse = { in: false, ndc: new THREE.Vector2(), x: 0, y: 0, ray: new THREE.Ray(), active: false };
let SPDK = 1;   // global speed factor (fish are lazier at night)
let RW = 0;     // A-04: вес ночного отдыха 0…1 (sim/rest.js); днём и на закате 0 — поведение прежнее
const SHELTER = REST.school.map(j => shelterTop(OBST[j], new THREE.Vector3()));   // укрытия стай над рифом (индекс k в updateSchool)
const SOLO_ROCK = new Map([[tangs, REST.solo.tang], [ytang, REST.solo.ytang], [idols, REST.solo.idol]]);   // камни одиночных рыб

function envForce(f, margin, out, strength, low) {
  const p = f.p;
  const xm = W / 2 - margin, zm = D / 2 - margin, yTop = HS - 0.5 - margin * 0.3, yBot = sandH(p.x, p.z) + (low ? 0.16 : 0.45 + margin * 0.4);
  if (p.x > xm) out.x -= (p.x - xm) * strength; if (p.x < -xm) out.x += (-xm - p.x) * strength;
  if (p.z > zm) out.z -= (p.z - zm) * strength; if (p.z < -zm) out.z += (-zm - p.z) * strength;
  if (p.y > yTop) out.y -= (p.y - yTop) * strength; if (p.y < yBot) out.y += (yBot - p.y) * strength * 1.5;
  for (let i = 0; i < OBST.length; i++) {
    const o = OBST[i];
    V1.set(p.x - o[0], p.y - o[1], p.z - o[2]); const d = V1.length(), R = o[3] + margin * 0.6;
    if (d < R) out.addScaledVector(V1.normalize(), (R - d) * strength * 1.2);
  }
}
function hardClamp(f, m, low) {
  const p = f.p;
  p.x = clamp(p.x, -W / 2 + m, W / 2 - m);
  p.z = clamp(p.z, -D / 2 + m, D / 2 - m);
  p.y = clamp(p.y, sandH(p.x, p.z) + (low ? 0.1 : 0.25), HS - 0.25);
}
function nearestFood(p, maxD) {
  let best = null, bd = maxD * maxD;
  for (let i = 0; i < FOOD_N; i++) { const fd = food[i]; if (fd.alive) { const d = fd.p.distanceToSquared(p); if (d < bd) { bd = d; best = fd; } } }
  return best;
}
// cursor avoidance + current; shared by all fish
function commonForces(f, sp, dt) {
  ACC.x += U.uCurrent.value.x * 0.5; ACC.z += U.uCurrent.value.y * 0.5;
  if (K.flee && mouse.active && !K.follow) {
    V1.subVectors(f.p, mouse.ray.origin); const along = V1.dot(mouse.ray.direction);
    if (along > 0) {
      V1.addScaledVector(mouse.ray.direction, -along); const d = V1.length(), R = 1.7;
      if (d < R && d > 1e-3) { const k = 1 - d / R; ACC.addScaledVector(V1, k * k * 26 / d); f.st = Math.max(f.st, k * 0.7); if (sp.home && k > 0.35) f.hide = Math.max(f.hide, 2.5); }
    }
  }
  f.st = Math.max(0, f.st - dt * 0.8);
  f.cd -= dt; if (f.hide > 0) f.hide -= dt;
}
function bite(f, fd, reach) {
  if (f.cd > 0) return false;
  if (f.p.distanceToSquared(fd.p) > reach * reach) return false;
  fd.hp--; f.cd = 0.45 + rnd() * 0.6; hungerBite(f);
  if (fd.hp <= 0) { fd.alive = false; foodAlive--; }
  f.v.addScaledVector(f.dir, -0.9);    // little dart back after each nibble
  return true;
}
function integrate(sp, f, dt, maxF, slow) {
  ACC.clampLength(0, maxF * (1 + f.st * 2));
  f.v.addScaledVector(ACC, dt);
  const sp2 = f.v.length(), boost = f.boost * (1 + f.st * 1.6), hi = speedHi(sp.speed[0], sp.speed[1], RW) * boost * SPDK, lo = sp.speed[0] * SPDK * (slow ? 0.3 : 1);
  if (sp2 > hi) f.v.multiplyScalar(hi / sp2);
  if (sp2 < lo) f.v.multiplyScalar(lo / Math.max(sp2, 1e-4));
  const lim = f.v.length() * (slow ? 0.9 : 0.45); f.v.y = clamp(f.v.y, -lim, lim);
  f.p.addScaledVector(f.v, dt);
}
function orient(sp, f, i, dt) {
  V2.copy(f.v).normalize();
  const old = V3.copy(f.dir);
  f.dir.lerp(V2, 1 - Math.exp(-dt * (sp.school ? 7 : 3.5))).normalize();
  const turn = old.cross(f.dir).y / Math.max(dt, 1e-3);
  f.bank += (clamp(-turn * 0.35, -0.6, 0.6) - f.bank) * (1 - Math.exp(-dt * 3));
  const spd = f.v.length() / sp.speed[1];
  f.phase += dt * sp.freq * (0.45 + 0.9 * spd + f.st);
  sp.ph.array[i] = f.phase;
  V1.crossVectors(f.dir, UPV).normalize();
  const up = V2.copy(UPV).multiplyScalar(Math.cos(f.bank)).addScaledVector(V1, Math.sin(f.bank));
  MAT.lookAt(f.dir, ZERO, up);
  SCL.setScalar(f.scale); MAT.scale(SCL); MAT.setPosition(f.p);
  sp.mesh.setMatrixAt(i, MAT);
}
function attractor(k, t, out) {
  const n = K.night;   // at night schools hang lower and tighter
  return out.set(Math.sin(t * 0.07 + k * 2.0) * 5.2 * (1 - 0.3 * n), 4.3 + Math.sin(t * 0.11 + k) * 1.7 - n * 1.3, Math.sin(t * 0.09 + k * 4.0) * 1.6 + 0.6);
}
function updateSchool(sp, k, dt, t) {
  const F = sp.fish, n = sp.count;
  attractor(k, t, ATT);
  if (RW > 0) restAttractor(ATT, SHELTER[k], RW, ATT);   // A-04: ночью стая стягивается к укрытию над рифом
  const R2 = 1.1 * 1.1, S2 = 0.32 * 0.32;
  for (let i = 0; i < n; i++) {
    const f = F[i]; ACC.set(0, 0, 0); hungerStep(f, dt);
    let cnt = 0; const ali = V1.set(0, 0, 0), coh = V2.set(0, 0, 0), sep = V3.set(0, 0, 0);
    for (let j = 0; j < n; j++) {
      if (j === i) continue; const g = F[j];
      const dx = g.p.x - f.p.x, dy = g.p.y - f.p.y, dz = g.p.z - f.p.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < R2) { ali.add(g.v); coh.add(g.p); cnt++; if (d2 < S2) { const k2 = 1 / Math.max(d2, 0.004); sep.x -= dx * k2; sep.y -= dy * k2; sep.z -= dz * k2; } }
    }
    const calm = 1 - Math.min(1, f.st * 1.5);   // startled fish break formation
    if (cnt) { ali.divideScalar(cnt).sub(f.v); ACC.addScaledVector(ali, 1.1 * calm); coh.divideScalar(cnt).sub(f.p); ACC.addScaledVector(coh, 0.9 * calm); }
    ACC.addScaledVector(sep, 0.09);
    V4.subVectors(ATT, f.p); ACC.addScaledVector(V4, 0.12 * calm);
    f.boost = 1;
    for (let b = 0; b < BIGS.length; b++) { const B = BIGS[b]; const dx = f.p.x - B.p.x, dy = f.p.y - B.p.y, dz = f.p.z - B.p.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 < 2.2) { const k3 = (2.2 - d2) * 2.5; ACC.x += dx * k3; ACC.y += dy * k3; ACC.z += dz * k3; f.boost = 1.3; } }
    let low = false, slow = false;
    if (foodAlive > 0) {
      const fd = nearestFood(f.p, foodReach(f, 6));
      if (fd) { V4.subVectors(fd.p, f.p); const d = V4.length(); ACC.addScaledVector(V4.normalize(), d < 0.8 ? 4.5 : 3.0); f.boost = foodBoost(f, 1.35); low = true; slow = d < 0.7; bite(f, fd, 0.2); }
    }
    commonForces(f, sp, dt);
    envForce(f, 0.9, ACC, 5, low);
    integrate(sp, f, dt, 6.0, slow);
    hardClamp(f, 0.25, low);
    orient(sp, f, i, dt);
  }
}
function pickTarget(sp, f) {
  if (sp.home) { const s = homeSpread(RW); f.target.set(sp.home.x + rr(-0.9, 0.9) * s, sp.home.y + rr(-0.4, 0.6) - K.night * 0.35, sp.home.z + rr(-0.9, 0.9) * s); return; }
  const rocks = SOLO_ROCK.get(sp);   // A-04: ночью с вероятностью RW — точка у бока камня; днём rnd() здесь не вызывается
  if (rocks && RW > 0 && rnd() < RW) { shelterSide(OBST[rocks[sp.fish.indexOf(f) % rocks.length]], rr(REST.side[0], REST.side[1]), f.target); return; }
  for (let tries = 0; tries < 12; tries++) {
    f.target.set(rr(-6.2, 6.2), rr(1.8, 7.0 - K.night * 2), rr(-2.0, 2.6));
    if (f.target.y < sandH(f.target.x, f.target.z) + 1.2) continue;
    let ok = true; for (const o of OBST) if (f.target.distanceTo(V1.set(o[0], o[1], o[2])) < o[3] + 0.8) { ok = false; break; }
    if (ok) break;
  }
}
function updateSolo(sp, dt) {
  const F = sp.fish;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    ACC.set(0, 0, 0);
    f.tt -= dt; hungerStep(f, dt);
    if (f.tt <= 0 || f.p.distanceTo(f.target) < 0.6) { pickTarget(sp, f); f.tt = rr(5, 12); }
    let tgt = f.target, low = false, slow = false;
    f.boost = 1;
    const hiding = sp.home && f.hide > 0;
    if (hiding) { tgt = V4.set(HIDE_P.x + Math.sin(i * 2.1) * 0.18, HIDE_P.y, HIDE_P.z + Math.cos(i * 2.1) * 0.18); f.boost = 1.6; low = true; slow = f.p.distanceTo(tgt) < 0.5; }
    else if (foodAlive > 0) {
      const fd = nearestFood(f.p, foodReach(f, sp.home ? 2.5 : 5));
      if (fd) { tgt = fd.p; f.boost = foodBoost(f, 1.4); low = true; slow = f.p.distanceTo(fd.p) < 0.9; bite(f, fd, 0.3 * f.scale + 0.15); }
    }
    V3.subVectors(tgt, f.p); const d = V3.length();
    V3.normalize().multiplyScalar(speedHi(sp.speed[0], sp.speed[1], RW) * f.boost * SPDK * Math.min(1, d / 1.5 + 0.3));
    ACC.addScaledVector(V3.sub(f.v), sp.home ? 1.6 : 0.8);
    for (const g of F) if (g !== f) { V1.subVectors(f.p, g.p); const d2 = V1.lengthSq(); if (d2 < 1.0) ACC.addScaledVector(V1, (1 - d2) * 2); }
    commonForces(f, sp, dt);
    if (!sp.home) envForce(f, 1.0 * f.scale + 0.3, ACC, 3, low); else envForce(f, 0.3, ACC, 3, true);
    integrate(sp, f, dt, sp.home ? 2.4 : 1.2, slow);
    hardClamp(f, sp.home ? 0.35 : 0.75, low || sp.home);
    orient(sp, f, i, dt);
  }
}
function setPopulation(p) {
  K.pop = p;
  for (const sp of [chromis, anthias]) {
    const n = Math.max(4, Math.round(sp.n * p));
    for (let i = sp.count; i < n; i++) {     // newcomers join next to an existing fish, so the school grows smoothly
      const src = sp.fish[(rnd() * Math.max(1, sp.count)) | 0];
      sp.fish[i].p.copy(src.p).add(V1.set(rr(-0.3, 0.3), rr(-0.2, 0.2), rr(-0.3, 0.3))); sp.fish[i].v.copy(src.v); hungerCopy(sp.fish[i], src);
    }
    sp.count = n; sp.mesh.count = n;
  }
}

// ------------------------------------------------------------------ interaction helpers
const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(), HIT = new THREE.Vector3();
function setRay(nx, ny, ray) { raycaster.setFromCamera(V1.set(nx, ny, 0), camera); ray.copy(raycaster.ray); return ray; }
const RAY = new THREE.Ray();
// a point "inside the tank" under the cursor: on a vertical plane through the orbit target facing the camera
function cursorPoint(nx, ny, out) {
  setRay(nx, ny, RAY);
  const inside = Math.abs(camera.position.x) < W / 2 && Math.abs(camera.position.z) < D / 2 && camera.position.y < HS;
  if (inside) return RAY.at(3.0, out);
  V2.subVectors(camera.position, controls.target); V2.y = 0; if (V2.lengthSq() < 1e-6) V2.set(0, 0, 1); V2.normalize();
  plane.setFromNormalAndCoplanarPoint(V2, controls.target);
  if (!RAY.intersectPlane(plane, out)) RAY.at(10, out);
  return out;
}
const FP = new THREE.Vector3();
function feedAt(nx, ny, n = 12, spread = 0.6) {
  cursorPoint(nx, ny, FP);
  dropFood(FP.x, FP.z + (Math.abs(camera.position.z) > D / 2 ? rr(-0.8, 0.8) : 0), n, spread);
}
// pick the fish (or jellyfish) closest to the cursor ray
// A-02: px > 0 — допуск пальца в пикселях: радиус растёт на px на экране, выбирается ближайшая к лучу (у мыши — как раньше)
function pickAt(nx, ny, px = 0) {
  setRay(nx, ny, RAY);
  let best = null, bt = Infinity;
  const pw = px * 2 * Math.tan(camera.fov * Math.PI / 360) / innerHeight;   // мировой размер пикселя на расстоянии 1
  for (const sp of SPECIES) {
    const n = sp.school ? sp.count : sp.fish.length;
    for (let i = 0; i < n; i++) {
      const f = sp.fish[i]; V1.subVectors(f.p, RAY.origin); const t = V1.dot(RAY.direction);
      if (t <= 0) continue;
      const d2 = V1.lengthSq() - t * t, r = sp.geo.L * f.scale * 0.55 + 0.12 + pw * t, sc = px ? d2 / (r * r) : t;
      if (d2 < r * r && sc < bt) { bt = sc; best = { sp, f }; }
    }
  }
  if (K.jelly) for (const j of jellies) {   // D-12: выключенные медузы не выбираются
    V1.subVectors(j.p, RAY.origin); const t = V1.dot(RAY.direction); if (t <= 0) continue;
    const d2 = V1.lengthSq() - t * t, r = j.s * 1.1 + pw * t, sc = px ? d2 / (r * r) : t; if (d2 < r * r && sc < bt) { bt = sc; best = { jelly: j }; }
  }
  return best;
}
const KN = new THREE.Vector3();
let shake = 0;
function knockAt(nx, ny) {
  setRay(nx, ny, RAY);
  // which pane faces the camera?
  const c = camera.position; let ok = false;
  if (c.z > D / 2) { plane.set(V1.set(0, 0, 1), -(D / 2 + 0.03)); ok = !!RAY.intersectPlane(plane, KN); }
  if (!ok && Math.abs(c.x) > W / 2) { const s = Math.sign(c.x); plane.set(V1.set(s, 0, 0), -(W / 2 + 0.03)); ok = !!RAY.intersectPlane(plane, KN); }
  if (!ok) cursorPoint(nx, ny, KN);
  KN.x = clamp(KN.x, -W / 2 - 0.03, W / 2 + 0.03); KN.y = clamp(KN.y, 0.2, HT - 0.2); KN.z = clamp(KN.z, -D / 2 - 0.03, D / 2 + 0.03);
  U.uKnock.value.set(KN.x, KN.y, KN.z, U.uRT.value);
  for (const sp of SPECIES) {
    const n = sp.school ? sp.count : sp.fish.length;
    for (let i = 0; i < n; i++) {
      const f = sp.fish[i]; V1.subVectors(f.p, KN); const d = V1.length(), k = clamp(1 - d / 10, 0, 1);
      if (k <= 0) continue;
      f.v.addScaledVector(V1.normalize(), (2.5 + 4 * k) * k); f.st = Math.max(f.st, 0.4 + 0.6 * k);
      if (sp.home) f.hide = 3.5 + 2.5 * k;
    }
  }
  if (K.jelly) for (const j of jellies) { j.v.y += 0.35; j.v.x += (j.p.x - KN.x) * 0.03; }   // скрытые медузы стук не копят
  ANEM_STARTLE.value = 1;
  ripple(clamp(KN.x, -W / 2 + 0.5, W / 2 - 0.5), clamp(KN.z, -D / 2 + 0.4, D / 2 - 0.4), 0.05);
  if (!K.follow && !RM.matches) shake = 1;
  sfxKnock();
}

// ------------------------------------------------------------------ procedural sound (off by default): water hum, bubble plops, knock thud
let AC = null, ambGain = null;
function audioInit() {
  if (AC) { AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
  const len = AC.sampleRate * 3, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  ambGain = AC.createGain(); ambGain.gain.value = 0;
  src.connect(lp).connect(ambGain).connect(AC.destination); src.start();
}
function sfxPlop() {
  if (!AC || !K.sound) return;
  const t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), f0 = 380 + Math.random() * 500;
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t0 + 0.07);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.025, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.1);
}
function sfxKnock() {
  if (!AC || !K.sound) return;
  for (let k = 0; k < 2; k++) {
    const t0 = AC.currentTime + k * 0.13, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.25);
  }
}

// ------------------------------------------------------------------ per-frame updates
let t = 0, rt = 0;
function updateBubbles(dt) {
  const cx = U.uCurrent.value.x, cz = U.uCurrent.value.y;
  for (let i = 0; i < BUB_N; i++) {
    const b = bub[i];
    if (b.dead) {
      if (!K.air) { MAT.makeScale(0, 0, 0); bubbles.setMatrixAt(i, MAT); continue; }
      b.wait -= dt; if (b.wait > 0) { MAT.makeScale(0, 0, 0); bubbles.setMatrixAt(i, MAT); continue; }
      b.dead = false; b.y = AERATOR.y + 0.1;
    }
    b.y += b.sp * dt;
    if (b.y > HS - 0.04) {
      if (K.air && rnd() < 0.5) sfxPlopMaybe();
      if (!K.air) { b.dead = true; b.wait = rr(0, 2.5); continue; }
      b.y = AERATOR.y + 0.1; b.r = rr(0.025, 0.08); b.sp = 0.9 + b.r * 9; b.ox = rr(-0.08, 0.08); b.oz = rr(-0.08, 0.08);
    }
    const h = b.y - AERATOR.y;
    const x = AERATOR.x + b.ox * (1 + h * 0.15) + Math.sin(t * 4 + b.ph + h * 2) * 0.03 * (1 + h * 0.2) + cx * h * 0.06;
    const z = AERATOR.z + b.oz * (1 + h * 0.15) + Math.cos(t * 3.3 + b.ph + h * 1.7) * 0.03 * (1 + h * 0.2) + cz * h * 0.06;
    const r = b.r * (1 + h * 0.03);
    MAT.makeScale(r * (1 + 0.12 * Math.sin(t * 9 + b.ph)), r * (0.85 + 0.1 * Math.cos(t * 9 + b.ph)), r);
    MAT.setPosition(clamp(x, -W / 2 + 0.1, W / 2 - 0.1), b.y, clamp(z, -D / 2 + 0.1, D / 2 - 0.1));
    bubbles.setMatrixAt(i, MAT);
  }
  bubbles.instanceMatrix.needsUpdate = true;
}
let plopT = 0;
function sfxPlopMaybe() { if (rt - plopT > 0.12) { plopT = rt; sfxPlop(); } }
function updateJellies(dt) {
  if (!K.jelly) return;
  for (const j of jellies) {
    j.t += dt;
    const cyc = (j.t * 0.42) % 1;
    const pulse = cyc < 0.3 ? Math.sin(cyc / 0.3 * Math.PI * 0.5) : Math.cos((cyc - 0.3) / 0.7 * Math.PI * 0.5);
    j.m.material.uniforms.uPulse.value = pulse * pulse;
    if (cyc < 0.3) j.v.y += 0.55 * dt;
    j.v.y -= 0.07 * dt;
    j.v.addScaledVector(j.drift, 0.03 * dt);
    j.v.x += U.uCurrent.value.x * 0.04 * dt; j.v.z += U.uCurrent.value.y * 0.04 * dt;
    j.nextDrift -= dt; if (j.nextDrift < 0) { j.nextDrift = rr(10, 20); j.drift.set(rr(-1, 1), 0, rr(-1, 1)).normalize(); }
    const p = j.p;
    if (p.y > 7.0) j.v.y -= (p.y - 7.0) * dt; if (p.y < 3.0) j.v.y += (3.0 - p.y) * dt * 1.5;
    if (Math.abs(p.x) > 5.5) j.v.x -= Math.sign(p.x) * dt * 0.3; if (Math.abs(p.z) > 2.0) j.v.z -= Math.sign(p.z) * dt * 0.3;
    for (const o of OBST) { V1.set(p.x - o[0], p.y - o[1], p.z - o[2]); const d = V1.length(); if (d < o[3] + 1.6) j.v.addScaledVector(V1.normalize(), dt * 0.4); }
    for (const k of jellies) if (k !== j) { V1.subVectors(p, k.p); const d = V1.length(); if (d < 1.6) j.v.addScaledVector(V1.normalize(), dt * 0.3); }
    j.v.multiplyScalar(Math.exp(-dt * 0.9));
    p.addScaledVector(j.v, dt);
    p.x = clamp(p.x, -W / 2 + 0.8, W / 2 - 0.8); p.z = clamp(p.z, -D / 2 + 0.7, D / 2 - 0.7);
    j.m.position.copy(p); j.m.scale.setScalar(j.s);
    j.m.rotation.z = Math.sin(j.t * 0.3) * 0.12; j.m.rotation.x = Math.cos(j.t * 0.25) * 0.1;
    j.lmat.opacity = 0.2 + 0.4 * K.night;
    const rim = j.s * (1 - 0.18 * pulse * pulse) * 0.95;
    let o = 0; const seg = 0.12 * j.s * 2.2, k = 1 - Math.exp(-dt * 6);
    for (const tn of j.tent) {
      const ch = tn.ch;
      ch[0].set(p.x + Math.cos(tn.a) * rim, p.y - 0.12 * j.s, p.z + Math.sin(tn.a) * rim);
      for (let s = 1; s < ch.length; s++) {
        const prev = ch[s - 1];
        V1.set(prev.x + Math.sin(t * 1.3 + tn.a * 3 + s * 0.5) * 0.02 + U.uCurrent.value.x * 0.012, prev.y - seg, prev.z + Math.cos(t * 1.1 + tn.a * 2 + s * 0.4) * 0.02 + U.uCurrent.value.y * 0.012);
        ch[s].lerp(V1, k);
        V2.subVectors(ch[s], prev); const L = V2.length(); if (L > seg) ch[s].copy(prev).addScaledVector(V2, seg / L);
        j.arr[o++] = prev.x; j.arr[o++] = prev.y; j.arr[o++] = prev.z; j.arr[o++] = ch[s].x; j.arr[o++] = ch[s].y; j.arr[o++] = ch[s].z;
      }
    }
    j.lines.geometry.attributes.position.needsUpdate = true;
  }
}
function updateFood(dt) {
  const cut = remainsCut(groundAges, foodGround);   // A-04 step 3: over REMAINS.cap the oldest leftovers dissolve faster
  let n = 0, gn = 0;
  for (let i = 0; i < FOOD_N; i++) {
    const f = food[i];
    if (f.alive) {
      f.t += dt;
      const g = sandH(f.p.x, f.p.z) + 0.05;
      if (f.p.y > g) {
        const floatPhase = f.t < 1.2;
        f.p.y -= (floatPhase ? 0.02 : 0.3) * dt;
        f.p.x += (Math.sin(t * 1.5 + f.ph) * 0.12 + U.uCurrent.value.x * 0.12) * dt; f.p.z += (Math.cos(t * 1.2 + f.ph) * 0.1 + U.uCurrent.value.y * 0.12) * dt;
        f.p.x = clamp(f.p.x, -W / 2 + 0.2, W / 2 - 0.2); f.p.z = clamp(f.p.z, -D / 2 + 0.2, D / 2 - 0.2);
        if (f.p.y < g) f.p.y = g;
      } else { f.ground = remainsAge(f.ground, dt, cut); if (remainsGone(f.ground)) f.alive = false; else groundAges[gn++] = f.ground; }   // leftovers dissolve after a while (A-04 step 3: capped)
    }
    if (f.alive) n++;
    foodArr[i * 3] = f.alive ? f.p.x : 0; foodArr[i * 3 + 1] = f.alive ? f.p.y : -999; foodArr[i * 3 + 2] = f.alive ? f.p.z : 0;
    foodSz[i] = f.alive ? (0.55 + 0.15 * f.hp) * remainsScale(f.ground) : 0;
  }
  foodAlive = n; foodGround = gn;
  foodG.attributes.position.needsUpdate = true; foodG.attributes.aSz.needsUpdate = true;
}

// light presets: day / sunset / night, blended continuously by K.night and K.warm
const C = (h) => new THREE.Color(h);
const PAL = {
  deep:    [C(0x02223a), C(0x161a44), C(0x010510)],
  shallow: [C(0x1f8fb0), C(0x66909c), C(0x0b2a52)],
  sky:     [new THREE.Color(0.75, 0.95, 1.0), new THREE.Color(1.0, 0.66, 0.4), new THREE.Color(0.18, 0.28, 0.6)],
  sun:     [C(0xfff1dc), C(0xffb88a), C(0x7f9fe0)],
  hemi:    [C(0x9fe4ff), C(0xffc6a0), C(0x3a5aa0)],
  caus:    [new THREE.Color(0.85, 1.0, 1.0), new THREE.Color(1.0, 0.86, 0.66), new THREE.Color(0.55, 0.75, 1.0)],
  ray:     [new THREE.Color(0.75, 0.95, 1.0), new THREE.Color(1.5, 0.85, 0.45), new THREE.Color(0.08, 0.12, 0.25)],
  lamp:    [C(0xdff6ff), C(0xffc890), C(0x3a5cc8)],
  murk:    new THREE.Color(0.22, 0.4, 0.3),
};
function mix3(arr, out) { return out.copy(arr[0]).lerp(arr[1], K.warm).lerp(arr[2], K.night); }
const mix1 = (a, b, c) => (a + (b - a) * K.warm) * (1 - K.night) + c * K.night;
function updateLighting() {
  mix3(PAL.deep, U.uDeep.value); mix3(PAL.shallow, U.uShallow.value);
  const murk = Math.max(0, K.turb - 0.3) * 0.7;
  if (murk > 0) { U.uShallow.value.lerp(PAL.murk, murk * (1 - K.night * 0.8)); U.uDeep.value.lerp(PAL.murk, murk * 0.25 * (1 - K.night)); }
  mix3(PAL.sky, U.uSky.value); mix3(PAL.sun, sun.color); mix3(PAL.hemi, hemi.color); mix3(PAL.caus, U.uCausCol.value);
  mix3(PAL.ray, U.uRayC.value); mix3(PAL.lamp, lampMat.color);
  sun.intensity = mix1(2.4, 2.0, 0.32); hemi.intensity = mix1(1.0, 0.85, 0.24); fill.intensity = mix1(0.5, 0.4, 0.3);
  U.uCaus.value = mix1(1.0, 0.85, 0.16); U.uNight.value = K.night; U.uWarm.value = K.warm;
  U.uGlowK.value = 1 + 1.5 * K.night; U.uTurb.value = 0.4 + 2.0 * K.turb;
  renderer.toneMappingExposure = 1.08 + 0.3 * K.night;
  for (const m of FISH_MATS) m.envMapIntensity = 0.55 * (1 - 0.75 * K.night);
  SPDK = 1 - 0.3 * K.night; RW = restWeight(K.night);
}

// ------------------------------------------------------------------ camera: intro dolly, auto-orbit, free mode, chase cam
const sph = new THREE.Spherical();
let lastInteract = -100, introT = 0, camReturn = 0, freeReturn = false;
const INTRO_FROM = new THREE.Vector3(0, 10.5, 40), SAVED_POS = new THREE.Vector3(), SAVED_TGT = new THREE.Vector3(), LOOK = new THREE.Vector3(), CH = new THREE.Vector3();
let fol = null;
controls.addEventListener('start', () => { lastInteract = rt; hideHint(); });
function updateCamera(rdt) {
  if (introT < 1) {
    introT = Math.min(1, introT + rdt / 4.5);
    const e = 1 - Math.pow(1 - introT, 3);
    camera.position.lerpVectors(INTRO_FROM, CAM_HOME, e); controls.target.copy(TGT_HOME); camera.lookAt(TGT_HOME);
    if (introT >= 1) { applyLimits(K.free ? LIM.free : LIM.tight); controls.enabled = !K.follow; lastInteract = rt - 3; }
    return;
  }
  if (K.follow && fol) {                       // chase camera behind the followed fish
    const f = fol.f, L = fol.sp.geo.L * f.scale, dist = Math.max(1.1, L * 3.4);
    V2.crossVectors(f.dir, UPV); if (V2.lengthSq() < 1e-4) V2.set(1, 0, 0); V2.normalize();
    CH.copy(f.p).addScaledVector(f.dir, -dist * 0.8).addScaledVector(V2, dist * 0.65 * fol.side); CH.y += dist * 0.22;
    CH.x = clamp(CH.x, -W / 2 + 0.25, W / 2 - 0.25); CH.z = clamp(CH.z, -D / 2 + 0.25, D / 2 - 0.25);
    CH.y = clamp(CH.y, sandH(CH.x, CH.z) + 0.25, HS - 0.2);
    camera.position.lerp(CH, 1 - Math.exp(-rdt * 3.2));
    LOOK.lerp(V1.copy(f.p).addScaledVector(f.dir, L * 0.8), 1 - Math.exp(-rdt * 6));
    camera.lookAt(LOOK);
    return;
  }
  if (camReturn > 0) {                          // glide back from the fish camera to the saved orbit view
    camReturn = Math.max(0, camReturn - rdt / 1.6);
    const k = 1 - Math.exp(-rdt * 4);
    camera.position.lerp(SAVED_POS, k); controls.target.lerp(SAVED_TGT, k); camera.lookAt(controls.target);
    if (camReturn === 0) { camera.position.copy(SAVED_POS); controls.target.copy(SAVED_TGT); controls.enabled = true; }
    return;
  }
  V1.subVectors(camera.position, controls.target); sph.setFromVector3(V1);
  if (freeReturn) {                             // free mode switched off: ease back into the normal limits instead of snapping
    const l = LIM.tight, a = 1 - Math.exp(-rdt * 2.5);
    const th = clamp(sph.theta, -l.az, l.az), phi = clamp(sph.phi, l.minP, l.maxP), r = clamp(sph.radius, l.minD, l.maxD);
    sph.theta += (th - sph.theta) * a; sph.phi += (phi - sph.phi) * a; sph.radius += (r - sph.radius) * a;
    V1.setFromSpherical(sph); camera.position.copy(controls.target).add(V1);
    controls.target.lerp(TGT_HOME, a);
    if (Math.abs(th - sph.theta) + Math.abs(phi - sph.phi) + Math.abs(r - sph.radius) < 0.01) { freeReturn = false; applyLimits(LIM.tight); }
    return;
  }
  if (!K.auto) return;
  const idle = rt - lastInteract, k = smooth(6, 14, idle);
  if (k <= 0) return;
  const a = rdt * 0.25 * k;
  if (K.free) {                                 // slow full circle around the tank
    sph.theta += rdt * 0.07 * k; sph.phi += (1.36 + 0.12 * Math.sin(rt * 0.05) - sph.phi) * a; sph.radius += (24 * camK - sph.radius) * a;
  } else {
    const thetaT = 0.42 * Math.sin(rt * 0.045), phiT = 1.47 + 0.07 * Math.sin(rt * 0.031), rT = (22 + 2.5 * Math.sin(rt * 0.027)) * camK;
    sph.theta += (thetaT - sph.theta) * a; sph.phi += (phiT - sph.phi) * a; sph.radius += (rT - sph.radius) * a;
  }
  V1.setFromSpherical(sph); camera.position.copy(controls.target).add(V1);
  controls.target.lerp(TGT_HOME, a);
}
const followEl = document.getElementById('follow'), followTxt = document.getElementById('followTxt');
followEl.inert = true;
document.getElementById('followExit').onclick = () => stopFollow();
function startFollow(target) {
  if (!target) {
    const pool = [clowns, tangs, ytang, idols, anthias, chromis], sp = pool[(rnd() * pool.length) | 0];
    target = { sp, f: sp.fish[(rnd() * (sp.school ? sp.count : sp.fish.length)) | 0] };
  }
  if (!K.follow) { SAVED_POS.copy(camera.position); SAVED_TGT.copy(controls.target); if (introT < 1) { SAVED_POS.copy(CAM_HOME); SAVED_TGT.copy(TGT_HOME); } LOOK.copy(target.f.p); }
  fol = target; fol.side = fol.side || (rnd() < 0.5 ? -1 : 1); K.follow = true; controls.enabled = false; camReturn = 0;
  followEl.inert = false; followTxt.innerHTML = S.follow(target.sp.name);   // сначала inert = false: иначе role=status молчит
  followEl.classList.add('on'); syncUI();
}
function stopFollow() {
  if (!K.follow) return;
  K.follow = false; fol = null; followEl.classList.remove('on');
  if (followEl.contains(document.activeElement)) cv.focus();
  followEl.inert = true;
  if (introT >= 1) camReturn = 1; syncUI();
}

// ------------------------------------------------------------------ control panel (glassmorphism, Russian)
// A-02: разметка и подписи — ui/strings.ru.js; у кнопок и переключателей имена без глифов, aria-pressed / role="switch",
// aria-keyshortcuts; у ползунков aria-valuetext; скрытая панель — inert; на телефоне панель — шторка (ui/sheet.js)
const panel = document.getElementById('panel'), openBtn = document.getElementById('open');
const SL = {}, TG = {}, PB = {};
panel.innerHTML = PANEL_HTML;
// после щелчка мышью или касания фокус уходит с кнопки, чтобы Пробел снова ставил паузу; с клавиатуры фокус остаётся
let panelPtrT = -1e9;
panel.addEventListener('pointerdown', () => { panelPtrT = performance.now(); });
const blurIfPointer = (el, e) => { if ((e && e.detail) || performance.now() - panelPtrT < 1000) el.blur(); };
panel.querySelectorAll('#presets button').forEach(b => { PB[b.dataset.p] = b; b.onclick = (e) => { setPreset(b.dataset.p); blurIfPointer(b, e); }; });
const fishTotal = () => chromis.count + anthias.count + 8;
const fmt = { ...FMT, pop: () => FMT.pop(fishTotal()) }, vtext = { ...VALUETEXT, pop: () => VALUETEXT.pop(fishTotal()) };
SLIDERS.forEach(([k, label, mn, mx, st]) => {
  const row = document.createElement('label'); row.className = 'row';
  row.innerHTML = `<span>${label}</span><input type="range" min="${mn}" max="${mx}" step="${st}"><output aria-hidden="true"></output>`;
  const inp = row.querySelector('input'), out = row.querySelector('output'); inp.value = K[k];
  inp.addEventListener('input', () => {
    const v = +inp.value;
    if (k === 'pop') setPopulation(v); else K[k] = v;
    if (k === 'night') { tween = null; preset = null; markPreset(); }
    out.textContent = fmt[k](v); inp.setAttribute('aria-valuetext', vtext[k](v));
  });
  inp.addEventListener('change', () => blurIfPointer(inp));
  SL[k] = { inp, out }; out.textContent = fmt[k](K[k]); inp.setAttribute('aria-valuetext', vtext[k](K[k]));
  panel.querySelector('#sliders').appendChild(row);
  if (k === 'pop') {   // A-04: подпись «стилизованное поведение» под ползунком «Рыбы»
    const note = document.createElement('p'); note.className = 'note'; note.id = 'behaviorNote'; note.textContent = BEHAVIOR_NOTE;
    inp.setAttribute('aria-describedby', 'behaviorNote'); row.after(note);
  }
});
TOGGLES.forEach(([k, label, key]) => {
  const row = document.createElement('label'); row.className = 'tog';
  row.innerHTML = `<span>${label}${key ? '<small aria-hidden="true">' + key + '</small>' : ''}</span><input type="checkbox" role="switch"${key ? ' aria-keyshortcuts="' + key + '"' : ''}>`;
  const inp = row.querySelector('input'); inp.checked = !!K[k];
  inp.addEventListener('change', () => { setToggle(k, inp.checked); blurIfPointer(inp); });
  TG[k] = inp; panel.querySelector('#toggles').appendChild(row);
  if (k === 'jelly') {   // D-12: подпись под переключателем «Медузы»
    const note = document.createElement('p'); note.className = 'note'; note.id = 'jellyNote'; note.textContent = JELLY_NOTE;
    inp.setAttribute('aria-describedby', 'jellyNote'); row.after(note);
  }
});
function setToggle(k, v) {
  if (k === 'follow') { v ? startFollow(null) : stopFollow(); return; }
  if (k === 'free') {
    K.free = v;
    if (v) { freeReturn = false; applyLimits(LIM.free); } else if (introT >= 1) freeReturn = true;
  } else K[k] = v;
  if (k === 'sound') { if (v) audioInit(); if (ambGain) ambGain.gain.setTargetAtTime(v ? 0.05 : 0, AC.currentTime, 0.4); }
  if (k === 'auto' && v) lastInteract = rt - 8;
  if (k === 'jelly') for (const j of jellies) { j.m.visible = !!v; j.lines.visible = !!v; }
  syncUI();
}
function syncUI() { for (const k in TG) TG[k].checked = !!K[k]; }
function syncSliders() { for (const k in SL) { SL[k].inp.value = K[k]; SL[k].out.textContent = fmt[k](K[k]); SL[k].inp.setAttribute('aria-valuetext', vtext[k](K[k])); } }
function markPreset() { for (const p in PB) { PB[p].classList.toggle('act', p === preset); PB[p].setAttribute('aria-pressed', String(p === preset)); } }
function setPreset(p) { preset = p; tween = PRESETS[p]; markPreset(); }
markPreset();
document.getElementById('bFeed').onclick = (e) => { dropFood(rr(-4, 4), rr(-1, 2), 16); blurIfPointer(e.currentTarget, e); };
document.getElementById('bKnock').onclick = (e) => { knockAt(rr(-0.5, 0.5), rr(-0.3, 0.2)); blurIfPointer(e.currentTarget, e); };
document.getElementById('bShot').onclick = (e) => { screenshot(); blurIfPointer(e.currentTarget, e); };
// скрытая боковая панель недоступна и для Tab (inert); фокус из неё переходит на кнопку «Показать панель» и обратно
function syncPanel() {
  const hid = panel.classList.contains('hid'), side = !SHEET.on;
  openBtn.classList.toggle('on', side && hid);
  openBtn.setAttribute('aria-expanded', String(!hid));
  if (side && hid && panel.contains(document.activeElement)) { openBtn.inert = false; openBtn.focus(); }
  panel.inert = side && hid; openBtn.inert = !(side && hid);
}
function togglePanel() {
  if (SHEET.on) { setStop(SHEET.stop === 'min' ? 'half' : 'min'); return; }
  const fromBtn = document.activeElement === openBtn, h = panel.classList.toggle('hid'); syncPanel();
  if (!h && fromBtn) PB.day.focus();
}
openBtn.onclick = (e) => { togglePanel(); if (e.detail) openBtn.blur(); };
let spdPrev = 1;
function togglePause() { if (K.spd > 0) { spdPrev = K.spd; K.spd = 0; } else K.spd = spdPrev || 1; syncSliders(); }

function screenshot() {
  renderer.setClearColor(0x03080c, 1);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.setClearColor(0x000000, 0);
  const a = document.createElement('a'); const d = new Date();
  a.href = url; a.download = 'akvarium-' + d.toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  const fl = document.getElementById('flash');
  if (!RM.matches) { fl.style.transition = 'none'; fl.style.opacity = '0.5'; requestAnimationFrame(() => { fl.style.transition = 'opacity .6s'; fl.style.opacity = '0'; }); }
  window.__aqShot = url.length;
}

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const c = e.code;
  // A-02: Пробел и Enter на кнопке, переключателе или ползунке достаются ему (как в Engine M-05d), а не паузе
  if ((c === 'Space' || c === 'Enter') && e.target.closest && e.target.closest('button, input, a[href]')) return;
  if (c === 'Space') { e.preventDefault(); togglePause(); }
  else if (c === 'KeyH') togglePanel();
  else if (c === 'Digit1' || c === 'Numpad1') setPreset('day');
  else if (c === 'Digit2' || c === 'Numpad2') setPreset('sunset');
  else if (c === 'Digit3' || c === 'Numpad3') setPreset('night');
  else if (c === 'KeyC') K.follow ? stopFollow() : startFollow(null);
  else if (c === 'Escape') { if (SHEET.on && SHEET.stop !== 'min') setStop('min'); else stopFollow(); }   // сначала верхний слой — шторка
  else if (c === 'KeyF') dropFood(rr(-4, 4), rr(-1, 2), 16);
  else if (c === 'KeyK') knockAt(rr(-0.5, 0.5), rr(-0.3, 0.2));
  else return;
  hideHint();
});

// ------------------------------------------------------------------ pointer input: click = feed, hold = sprinkle, double-click = follow, right-click = knock
// A-02: те же жесты пальцем — касание, удержание, двойное касание (ui/gestures.js, без dblclick); второй палец — только
// масштаб; долгое касание не вызывает контекстное меню и не стучит; касание рыбы показывает её подпись на 2,5 с
const cv = renderer.domElement, tip = document.getElementById('tip');
cv.tabIndex = 0; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', S.scene);
const GS = createGestures();
let clickTimer = 0, sprinkleT = 0, ptrType = 'mouse', touchTip = 0;
const ndcOf = (e, out) => out.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
const NDC = new THREE.Vector2();
const pointAt = (e) => { mouse.in = true; mouse.x = e.clientX; mouse.y = e.clientY; ndcOf(e, mouse.ndc); };
cv.addEventListener('pointerdown', (e) => {
  ptrType = e.pointerType || 'mouse';
  if (ptrType === 'mouse' && e.button !== 0) return;
  if (ptrType !== 'mouse') pointAt(e);              // у пальца нет наведения: точка корма и фонарика — под пальцем
  GS.down(e.pointerId, e.clientX, e.clientY, e.timeStamp, ptrType);
  if (K.sound) audioInit();
});
cv.addEventListener('pointermove', (e) => { ptrType = e.pointerType || 'mouse'; pointAt(e); GS.move(e.pointerId, e.clientX, e.clientY); });
cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' || !GS.active()) mouse.in = false; if (!touchTip) tip.classList.remove('on'); });
cv.addEventListener('pointercancel', (e) => { GS.cancel(e.pointerId); if (!GS.active() && e.pointerType !== 'mouse') mouse.in = false; });
cv.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const g = GS.up(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  if (e.pointerType !== 'mouse' && !GS.active()) mouse.in = false;
  if (g.type === 'none') return;
  ndcOf(e, NDC); const nx = NDC.x, ny = NDC.y;
  if (g.type === 'double') {
    clearTimeout(clickTimer); clickTimer = 0;            // double-click: follow a fish (or feed once if nothing was hit)
    const hit = pickAt(nx, ny, KIND[e.pointerType === 'mouse' ? 'mouse' : 'touch'].pickPx);
    if (hit && hit.f) startFollow(hit);
    else if (!K.follow) feedAt(nx, ny);
    return;
  }
  if (e.pointerType !== 'mouse') showTouchTip(nx, ny, e.clientX, e.clientY);
  clickTimer = setTimeout(() => { clickTimer = 0; feedAt(nx, ny); hideHint(); }, g.wait);
});
cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (ptrType === 'touch') return; ndcOf(e, NDC); knockAt(NDC.x, NDC.y); hideHint(); });
cv.addEventListener('wheel', () => { lastInteract = rt; }, { passive: true });
cv.addEventListener('dblclick', (e) => e.preventDefault());

// hint & tooltip
const hintEl = document.getElementById('hint');
let hintHidden = false;
function hideHint() { if (!hintHidden) { hintHidden = true; hintEl.classList.remove('on'); } }
setTimeout(() => { if (!hintHidden) hintEl.classList.add('on'); }, 4800);
setTimeout(hideHint, 20000);
let tipFrame = 0, tipShown = null;
const tipHTML = (hit, how) => hit.jelly ? JELLY_TIP : hit.sp.name + '<i>' + hit.sp.latin + (hit.f ? S.tipFollow[how] : '') + '</i>';
// касание рыбы или медузы: подпись у пальца на 2,5 с (наведения у пальца нет)
function showTouchTip(nx, ny, x, y) {
  const hit = pickAt(nx, ny, KIND.touch.pickPx);
  if (!hit) return;
  tip.innerHTML = tipHTML(hit, 'touch'); tipShown = 'touch'; touchTip = performance.now() + 2500;
  tip.style.left = Math.max(8, Math.min(x, innerWidth - tip.offsetWidth - 22)) + 'px'; tip.style.top = Math.max(24, y - 36) + 'px';
  tip.classList.add('on');
}
function updateTooltip() {
  if (++tipFrame % 5) return;
  if (touchTip) { if (performance.now() < touchTip) return; touchTip = 0; tipShown = null; tip.classList.remove('on'); }
  const hit = (mouse.in && !GS.active() && ptrType === 'mouse') ? pickAt(mouse.ndc.x, mouse.ndc.y) : null;
  const key = hit ? (hit.jelly ? 'jelly' : hit.sp.key) : null;
  if (key !== tipShown) {
    tipShown = key;
    if (hit) tip.innerHTML = tipHTML(hit, 'mouse');
    tip.classList.toggle('on', !!hit); cv.classList.toggle('fishy', !!(hit && hit.f));
  }
  if (hit) { tip.style.left = mouse.x + 'px'; tip.style.top = mouse.y + 'px'; }
}

// grain texture (generated once on a small canvas)
{
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), im = g.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  const gr = document.getElementById('grain'); gr.style.backgroundImage = 'url(' + c.toDataURL() + ')'; gr.style.mixBlendMode = 'overlay'; gr.style.opacity = '0.06';
}

// ------------------------------------------------------------------ main loop
let viewOff = 0, viewOffY = 0;
// keep the whole tank in frame on narrow / portrait windows by widening the vertical FOV
// A-02: на телефоне в портрете угла 70° не хватает на ширину аквариума — камера отодвигается (camK > 1): точка обзора,
// пролёт, автокамера и пределы расстояния OrbitControls растут в camK раз. Шире ≈ 0,68 (альбом, компьютер) camK = 1
const FIT_TAN = (W / 2 + 0.8) / (CAM_HOME.z - D / 2);   // полуширина аквариума с запасом на расстоянии переднего стекла
const HOME0 = CAM_HOME.clone(), INTRO0 = INTRO_FROM.clone(), LIM0 = { t: LIM.tight.minD, T: LIM.tight.maxD, F: LIM.free.maxD };
let camK = 1;
function fitFov() {
  const a = innerWidth / innerHeight; camera.fov = a < 1.75 ? Math.min(70, 2 * Math.atan(Math.tan(19 * Math.PI / 180) * 1.75 / a) * 180 / Math.PI) : 38;
  const k = Math.max(1, FIT_TAN / (Math.tan(camera.fov * Math.PI / 360) * a)), r = k / camK;
  if (Math.abs(r - 1) < 1e-6) return;
  camK = k;
  CAM_HOME.subVectors(HOME0, TGT_HOME).multiplyScalar(k).add(TGT_HOME); INTRO_FROM.subVectors(INTRO0, TGT_HOME).multiplyScalar(k).add(TGT_HOME);
  LIM.tight.minD = LIM0.t * k; LIM.tight.maxD = LIM0.T * k; LIM.free.maxD = LIM0.F * k;
  if (introT >= 1) {                                 // поворот телефона после запуска: тот же вид, но с новым расстоянием
    if (!K.follow && camReturn === 0) camera.position.sub(controls.target).multiplyScalar(r).add(controls.target);
    SAVED_POS.sub(SAVED_TGT).multiplyScalar(r).add(SAVED_TGT);
    applyLimits(K.free ? LIM.free : LIM.tight);
  }
}
fitFov(); camera.updateProjectionMatrix();
// панель: ниже 900 px скрыта при запуске; на телефоне — свёрнутая шторка (ui/sheet.js)
if (innerWidth < 900) panel.classList.add('hid');
initSheet({ panel, grip: document.getElementById('grip'), body: document.getElementById('pbody'), btns: panel.querySelector('.btns'), keys: document.getElementById('keys') }, syncPanel);
// A-02: на телефоне кадр сдвигается вверх, в свободную область над шторкой (не больше половины окна)
function applyViewOffset() { camera.setViewOffset(innerWidth, innerHeight, viewOff, viewOffY, innerWidth, innerHeight); camera.updateProjectionMatrix(); }
if (RM.matches) introT = 0.999;                    // reduced motion: без пролёта камеры, сразу исходный вид
const DEBUG = new URLSearchParams(location.search).has('debug');
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps');
fpsEl.hidden = !DEBUG;                              // A-02: счётчик кадров — только с ?debug (как в Engine M-05d)
let fpsFrames = 0, fpsAcc = 0, booted = false;

// A-01: адаптивное разрешение в обе стороны, с гистерезисом; решение — чистая функция adaptStep (adapt.js)
const NOADAPT = new URLSearchParams(location.search).has('noadapt');   // ?noadapt — разрешение не меняется (для сравнения кадров)
const AD = { s: { ...ADAPT0, pr: pixelRatio }, frames: 0, acc: 0, t0: 0 };
function adaptFrame(rawDt) {
  AD.frames++; AD.acc += rawDt;
  if (AD.acc <= ADAPT.WIN) return;
  const ft = AD.acc / AD.frames;
  if (!NOADAPT && performance.now() - AD.t0 > ADAPT.WARM * 1000) {
    AD.s = adaptStep(AD.s, 1 / ft, MAXPR);
    if (AD.s.pr !== pixelRatio) { storePixelRatio(AD.s.pr); renderer.setPixelRatio(pixelRatio); U.uPR.value = pixelRatio; }
  }
  window.__aq = { ft, pixelRatio, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  AD.frames = 0; AD.acc = 0;
}
// окно измерения начинается заново после фоновой вкладки и паузы: долгий кадр после возврата — не «медленный»
function adaptReset() { AD.frames = 0; AD.acc = 0; clock.getDelta(); }
document.addEventListener('visibilitychange', adaptReset);
const SHK = new THREE.Vector3();
function frame() {
  const rawDt = clock.getDelta();
  const rdt = Math.min(rawDt, 0.05), dt = rdt * K.spd;
  t += dt; rt += rdt;
  U.uTime.value = t; U.uRT.value = rt;
  // preset transition
  if (tween) {
    const a = 1 - Math.exp(-rdt * 1.6);
    K.night += (tween.night - K.night) * a; K.warm += (tween.warm - K.warm) * a;
    if (Math.abs(tween.night - K.night) + Math.abs(tween.warm - K.warm) < 0.002) { K.night = tween.night; K.warm = tween.warm; tween = null; }
    SL.night.inp.value = K.night; SL.night.out.textContent = fmt.night(K.night); SL.night.inp.setAttribute('aria-valuetext', vtext.night(K.night));
  }
  updateLighting();
  // current: slowly veering direction, strength from the slider; drift integrated so the slider never makes particles jump
  const ca = (0.6 + 0.4 * Math.sin(t * 0.13)) * K.cur / 0.6;
  U.uCurrent.value.set(Math.cos(t * 0.05) * ca, Math.sin(t * 0.05) * 0.5 * ca);
  U.uDrift.value.addScaledVector(U.uCurrent.value, dt * 0.05);
  ANEM_STARTLE.value = Math.max(0, ANEM_STARTLE.value - dt * 0.35);
  // cursor ray (flee + torch)
  mouse.active = mouse.in && introT >= 1;
  if (mouse.in) {
    setRay(mouse.ndc.x, mouse.ndc.y, mouse.ray);
    if (GS.hold(performance.now())) { clearTimeout(clickTimer); clickTimer = 0; }
    if (GS.holding()) { sprinkleT -= rdt; if (sprinkleT <= 0) { sprinkleT = 0.07; feedAt(mouse.ndc.x, mouse.ndc.y, 2, 0.35); } }
  }
  const torchOn = K.torch && mouse.active;
  if (mouse.in) { cursorPoint(mouse.ndc.x, mouse.ndc.y, V4); V4.addScaledVector(mouse.ray.direction, -1.6); V4.x = clamp(V4.x, -W / 2, W / 2); V4.y = clamp(V4.y, 0.5, HS); V4.z = clamp(V4.z, -D / 2, D / 2 + 1); torch.position.lerp(V4, 1 - Math.exp(-rdt * 12)); }
  torch.intensity += ((torchOn ? 5 + 16 * K.night : 0) - torch.intensity) * (1 - Math.exp(-rdt * 8));

  updateFood(dt);
  updateSchool(chromis, 0, dt, t);
  updateSchool(anthias, 1, dt, t);
  updateSolo(clowns, dt); updateSolo(tangs, dt); updateSolo(ytang, dt); updateSolo(idols, dt);
  for (const sp of SPECIES) { sp.mesh.instanceMatrix.needsUpdate = true; sp.ph.needsUpdate = true; }
  updateBubbles(dt);
  updateJellies(dt);
  updateCamera(rdt);
  if (controls.enabled && !K.follow && camReturn === 0) controls.update();
  updateTooltip();
  // shift the projection centre left while the panel is open, so the panel never covers the tank
  const offT = (!SHEET.on && !panel.classList.contains('hid') && innerWidth > 860) ? Math.min(120, innerWidth * 0.075) : 0;
  const offY = SHEET.on ? Math.min(SHEET.h, innerHeight * 0.5) / 2 : 0;
  if (Math.abs(offT - viewOff) + Math.abs(offY - viewOffY) > 0.3) {
    const a = RM.matches ? 1 : 1 - Math.exp(-rdt * 5);
    viewOff += (offT - viewOff) * a; viewOffY += (offY - viewOffY) * a; applyViewOffset();
  }
  if (K.sound && ambGain && K.air && Math.random() < rdt * 2.5) sfxPlopMaybe();
  // knock shake (applied only for this render)
  if (shake > 0.001) { shake *= Math.exp(-rdt * 7); SHK.set(Math.sin(rt * 90) * 0.05, Math.cos(rt * 77) * 0.035, 0).multiplyScalar(shake); camera.position.add(SHK); }
  renderer.render(scene, camera);
  if (shake > 0.001) camera.position.sub(SHK);
  if (!booted) { booted = true; window.__ok = 1; AD.t0 = performance.now(); window.__aqScreen('ready'); }
  // fps counter + adaptive resolution
  fpsFrames++; fpsAcc += rawDt;
  if (fpsAcc > 0.5) { if (DEBUG) fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + ' fps'; fpsFrames = 0; fpsAcc = 0; }
  adaptFrame(rawDt);
}
// A-01: цикл кадров. Пока WebGL-контекст потерян — пауза (симуляция стоит); ошибку кадра сообщаем в консоль один раз,
// если она повторяется 30 кадров подряд — цикл останавливается с сообщением (раньше первая же ошибка молча останавливала цикл)
const run = { lost: false, stopped: false, errors: 0, timer: 0 };
function loop() {
  if (run.stopped) return;
  if (run.lost) { clock.getDelta(); return; }
  try {
    frame();
    run.errors = 0;
  } catch (err) {
    if (++run.errors === 1) console.error(err);
    if (run.errors >= 30) {
      run.stopped = true; renderer.setAnimationLoop(null); clearTimeout(run.timer); window.__aqFailed = true;
      window.__aqScreen('failed', '<b>Аквариум остановлен из-за ошибки.</b><br><span class="why">' +
        window.__aqEsc(err && err.message ? err.message : err) + '<br>Перезагрузите страницу.</span>', ['reload']);
    }
  }
}
// A-01: потеря и восстановление WebGL-контекста. Обработчики three.js стоят раньше (preventDefault — контекст можно вернуть);
// после restore three.js сам заново загружает геометрии, материалы и canvas-текстуры, окружение (PMREM) строим заново
renderer.domElement.addEventListener('webglcontextlost', () => {
  if (run.stopped) return;                  // после остановки сообщение об ошибке остаётся на экране
  run.lost = true;
  window.__aqScreen('lost', 'Графика временно недоступна: браузер сбросил WebGL-контекст. Восстанавливаю…');
  clearTimeout(run.timer);
  run.timer = setTimeout(() => window.__aqScreen('failed', '<b>Не удалось восстановить графику.</b><br><span class="why">' +
    'Браузер не вернул WebGL-контекст. Перезагрузите страницу.</span>', ['reload']), 10000);
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  if (run.stopped) return;
  clearTimeout(run.timer);
  storeEnv(makeEnv());                          // старая текстура осталась в потерянном контексте
  for (const m of FISH_MATS) m.envMap = ENV;
  run.lost = false; adaptReset();
  window.__aqScreen(booted ? 'ready' : 'booting');
});
// A-04: initial hunger from a separate generator, so the scene seed sequence stays unchanged
{ let s = 4204; const hr = () => (s = s * 16807 % 2147483647) / 2147483647; for (const sp of SPECIES) for (const f of sp.fish) hungerInit(f, hr); }
// warm the simulation so fish start in natural formations
for (let i = 0; i < 90; i++) { t += 1 / 30; U.uTime.value = t; updateSchool(chromis, 0, 1 / 30, t); updateSchool(anthias, 1, 1 / 30, t); updateSolo(clowns, 1 / 30); updateSolo(tangs, 1 / 30); updateSolo(ytang, 1 / 30); updateSolo(idols, 1 / 30); }
renderer.setAnimationLoop(loop);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; fitFov(); applyViewOffset();
  renderer.setSize(innerWidth, innerHeight);
});
// debug / test hooks. A-01 (T-11): setPopulation из API двигает и слайдер «Рыбы»; доля ограничена диапазоном слайдера
// (больше 1 — рыб не хватает в массиве стаи)
function apiSetPopulation(p) { setPopulation(clamp(+p || 0, 0.05, 1)); syncSliders(); }
window.__aqAPI = { skipIntro() { introT = 0.999; }, get introT() { return introT; }, K, setPreset, setToggle, setPopulation: apiSetPopulation, dropFood, feedAt, knockAt, pickAt, startFollow, stopFollow, screenshot, togglePause, togglePanel, SPECIES, camera, controls, get fol() { return fol; }, get foodAlive() { return foodAlive; } };
