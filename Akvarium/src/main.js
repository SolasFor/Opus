/**
 * Akvarium — точка входа (A-01b): корм, состояние K и пресеты, симуляция рыб, взаимодействие, звук,
 * покадровые обновления, камера, панель, ввод, цикл кадров, адаптивное разрешение, потеря контекста,
 * window.__aqAPI.
 * Тело — строки 1187–1962 модуля однофайловой Aquarium.html (D-13), перенесены дословно; швы — tests/split.test.js.
 * Швы: pixelRatio = … → storePixelRatio(…), ENV = makeEnv() → storeEnv(makeEnv()).
 */
import * as THREE from 'three';
import { applyLimits, CAM_HOME, camera, clamp, controls, D, fill, hemi, HS, HT, LIM, MAXPR, pixelRatio, renderer, rnd, rr, scene, smooth, storePixelRatio, sun, TGT_HOME, torch, U, W } from './core.js';
import { AERATOR, ANEM_STARTLE, ANEMONES, lampMat, ripple, sandH } from './scenery.js';
import { anthias, bub, BUB_N, bubbles, chromis, clowns, ENV, FISH_MATS, idols, jellies, makeEnv, SPECIES, storeEnv, tangs, ytang } from './creatures.js';

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
let foodCursor = 0, foodAlive = 0;
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
const K = { night: 0, warm: 0, cur: 0.6, turb: 0.3, spd: 1, pop: 0.6, air: true, auto: true, free: false, follow: false, torch: true, flee: true, sound: false };
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
  fd.hp--; f.cd = 0.45 + rnd() * 0.6;
  if (fd.hp <= 0) { fd.alive = false; foodAlive--; }
  f.v.addScaledVector(f.dir, -0.9);    // little dart back after each nibble
  return true;
}
function integrate(sp, f, dt, maxF, slow) {
  ACC.clampLength(0, maxF * (1 + f.st * 2));
  f.v.addScaledVector(ACC, dt);
  const sp2 = f.v.length(), boost = f.boost * (1 + f.st * 1.6), hi = sp.speed[1] * boost * SPDK, lo = sp.speed[0] * SPDK * (slow ? 0.3 : 1);
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
  const R2 = 1.1 * 1.1, S2 = 0.32 * 0.32;
  for (let i = 0; i < n; i++) {
    const f = F[i]; ACC.set(0, 0, 0);
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
      const fd = nearestFood(f.p, 6);
      if (fd) { V4.subVectors(fd.p, f.p); const d = V4.length(); ACC.addScaledVector(V4.normalize(), d < 0.8 ? 4.5 : 3.0); f.boost = 1.35; low = true; slow = d < 0.7; bite(f, fd, 0.2); }
    }
    commonForces(f, sp, dt);
    envForce(f, 0.9, ACC, 5, low);
    integrate(sp, f, dt, 6.0, slow);
    hardClamp(f, 0.25, low);
    orient(sp, f, i, dt);
  }
}
function pickTarget(sp, f) {
  if (sp.home) { f.target.set(sp.home.x + rr(-0.9, 0.9), sp.home.y + rr(-0.4, 0.6) - K.night * 0.35, sp.home.z + rr(-0.9, 0.9)); return; }
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
    f.tt -= dt;
    if (f.tt <= 0 || f.p.distanceTo(f.target) < 0.6) { pickTarget(sp, f); f.tt = rr(5, 12); }
    let tgt = f.target, low = false, slow = false;
    f.boost = 1;
    const hiding = sp.home && f.hide > 0;
    if (hiding) { tgt = V4.set(HIDE_P.x + Math.sin(i * 2.1) * 0.18, HIDE_P.y, HIDE_P.z + Math.cos(i * 2.1) * 0.18); f.boost = 1.6; low = true; slow = f.p.distanceTo(tgt) < 0.5; }
    else if (foodAlive > 0) {
      const fd = nearestFood(f.p, sp.home ? 2.5 : 5);
      if (fd) { tgt = fd.p; f.boost = 1.4; low = true; slow = f.p.distanceTo(fd.p) < 0.9; bite(f, fd, 0.3 * f.scale + 0.15); }
    }
    V3.subVectors(tgt, f.p); const d = V3.length();
    V3.normalize().multiplyScalar(sp.speed[1] * f.boost * SPDK * Math.min(1, d / 1.5 + 0.3));
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
      sp.fish[i].p.copy(src.p).add(V1.set(rr(-0.3, 0.3), rr(-0.2, 0.2), rr(-0.3, 0.3))); sp.fish[i].v.copy(src.v);
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
function pickAt(nx, ny) {
  setRay(nx, ny, RAY);
  let best = null, bt = Infinity;
  for (const sp of SPECIES) {
    const n = sp.school ? sp.count : sp.fish.length;
    for (let i = 0; i < n; i++) {
      const f = sp.fish[i]; V1.subVectors(f.p, RAY.origin); const t = V1.dot(RAY.direction);
      if (t <= 0) continue;
      const d2 = V1.lengthSq() - t * t, r = sp.geo.L * f.scale * 0.55 + 0.12;
      if (d2 < r * r && t < bt) { bt = t; best = { sp, f }; }
    }
  }
  for (const j of jellies) {
    V1.subVectors(j.p, RAY.origin); const t = V1.dot(RAY.direction); if (t <= 0) continue;
    const d2 = V1.lengthSq() - t * t, r = j.s * 1.1; if (d2 < r * r && t < bt) { bt = t; best = { jelly: j }; }
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
  for (const j of jellies) { j.v.y += 0.35; j.v.x += (j.p.x - KN.x) * 0.03; }
  ANEM_STARTLE.value = 1;
  ripple(clamp(KN.x, -W / 2 + 0.5, W / 2 - 0.5), clamp(KN.z, -D / 2 + 0.4, D / 2 - 0.4), 0.05);
  if (!K.follow) shake = 1;
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
  let n = 0;
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
      } else { f.ground += dt; if (f.ground > 16) f.alive = false; }   // leftovers dissolve after a while
    }
    if (f.alive) n++;
    foodArr[i * 3] = f.alive ? f.p.x : 0; foodArr[i * 3 + 1] = f.alive ? f.p.y : -999; foodArr[i * 3 + 2] = f.alive ? f.p.z : 0;
    foodSz[i] = f.alive ? (0.55 + 0.15 * f.hp) * (f.ground > 13 ? (16 - f.ground) / 3 : 1) : 0;
  }
  foodAlive = n;
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
  SPDK = 1 - 0.3 * K.night;
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
    sph.theta += rdt * 0.07 * k; sph.phi += (1.36 + 0.12 * Math.sin(rt * 0.05) - sph.phi) * a; sph.radius += (24 - sph.radius) * a;
  } else {
    const thetaT = 0.42 * Math.sin(rt * 0.045), phiT = 1.47 + 0.07 * Math.sin(rt * 0.031), rT = 22 + 2.5 * Math.sin(rt * 0.027);
    sph.theta += (thetaT - sph.theta) * a; sph.phi += (phiT - sph.phi) * a; sph.radius += (rT - sph.radius) * a;
  }
  V1.setFromSpherical(sph); camera.position.copy(controls.target).add(V1);
  controls.target.lerp(TGT_HOME, a);
}
const followEl = document.getElementById('follow');
function startFollow(target) {
  if (!target) {
    const pool = [clowns, tangs, ytang, idols, anthias, chromis], sp = pool[(rnd() * pool.length) | 0];
    target = { sp, f: sp.fish[(rnd() * (sp.school ? sp.count : sp.fish.length)) | 0] };
  }
  if (!K.follow) { SAVED_POS.copy(camera.position); SAVED_TGT.copy(controls.target); if (introT < 1) { SAVED_POS.copy(CAM_HOME); SAVED_TGT.copy(TGT_HOME); } LOOK.copy(target.f.p); }
  fol = target; fol.side = fol.side || (rnd() < 0.5 ? -1 : 1); K.follow = true; controls.enabled = false; camReturn = 0;
  followEl.innerHTML = 'Камера следует: <b>' + target.sp.name + '</b> · <span style="opacity:.6">C / Esc — выход, двойной клик — другая рыба</span>';
  followEl.classList.add('on'); syncUI();
}
function stopFollow() {
  if (!K.follow) return;
  K.follow = false; fol = null; followEl.classList.remove('on');
  if (introT >= 1) camReturn = 1; syncUI();
}

// ------------------------------------------------------------------ control panel (glassmorphism, Russian)
const panel = document.getElementById('panel'), openBtn = document.getElementById('open');
const SL = {}, TG = {}, PB = {};
panel.innerHTML = `<h3>Аквариум <span>H — скрыть</span></h3>
  <div class="sec">Освещение</div>
  <div class="seg" id="presets"><button data-p="day">День<b>1</b></button><button data-p="sunset">Закат<b>2</b></button><button data-p="night">Ночь<b>3</b></button></div>
  <div class="sec">Вода</div><div id="sliders"></div>
  <div class="sec">Режимы</div><div id="toggles"></div>
  <div class="btns"><button id="bFeed">Покормить</button><button id="bKnock">Стук</button><button id="bShot">Снимок</button></div>
  <div id="keys"><kbd>клик</kbd> корм · <kbd>зажать</kbd> сыпать · <kbd>2×клик</kbd> по рыбе — следить · <kbd>ПКМ</kbd> стук по стеклу · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> свет · <kbd>C</kbd> камера-рыба · <kbd>Пробел</kbd> пауза · <kbd>F</kbd> корм · <kbd>K</kbd> стук · <kbd>H</kbd> панель</div>`;
panel.querySelectorAll('#presets button').forEach(b => { PB[b.dataset.p] = b; b.onclick = () => { setPreset(b.dataset.p); b.blur(); }; });
const fmt = { night: v => Math.round(v * 100) + '%', cur: v => v.toFixed(1), turb: v => Math.round(v * 100) + '%', spd: v => v === 0 ? 'пауза' : v.toFixed(1) + '×', pop: v => String(chromis.count + anthias.count + 8) };
[['night', 'Ночь', 0, 1, 0.01], ['cur', 'Течение', 0, 2, 0.01], ['turb', 'Мутность', 0, 1, 0.01], ['spd', 'Время', 0, 2.5, 0.05], ['pop', 'Рыбы', 0.05, 1, 0.01]].forEach(([k, label, mn, mx, st]) => {
  const row = document.createElement('label'); row.className = 'row';
  row.innerHTML = `<span>${label}</span><input type="range" min="${mn}" max="${mx}" step="${st}"><output></output>`;
  const inp = row.querySelector('input'), out = row.querySelector('output'); inp.value = K[k];
  inp.addEventListener('input', () => {
    const v = +inp.value;
    if (k === 'pop') setPopulation(v); else K[k] = v;
    if (k === 'night') { tween = null; preset = null; markPreset(); }
    out.textContent = fmt[k](v);
  });
  inp.addEventListener('change', () => inp.blur());
  SL[k] = { inp, out }; out.textContent = fmt[k](K[k]);
  panel.querySelector('#sliders').appendChild(row);
});
[['air', 'Аэратор', ''], ['auto', 'Автокамера', ''], ['free', 'Свободная камера', ''], ['follow', 'Вид от рыбы', 'C'], ['torch', 'Фонарик у курсора', ''], ['flee', 'Рыбы боятся курсора', ''], ['sound', 'Звук', '']].forEach(([k, label, key]) => {
  const row = document.createElement('label'); row.className = 'tog';
  row.innerHTML = `<span>${label}${key ? '<small>' + key + '</small>' : ''}</span><input type="checkbox">`;
  const inp = row.querySelector('input'); inp.checked = !!K[k];
  inp.addEventListener('change', () => { setToggle(k, inp.checked); inp.blur(); });
  TG[k] = inp; panel.querySelector('#toggles').appendChild(row);
});
function setToggle(k, v) {
  if (k === 'follow') { v ? startFollow(null) : stopFollow(); return; }
  if (k === 'free') {
    K.free = v;
    if (v) { freeReturn = false; applyLimits(LIM.free); } else if (introT >= 1) freeReturn = true;
  } else K[k] = v;
  if (k === 'sound') { if (v) audioInit(); if (ambGain) ambGain.gain.setTargetAtTime(v ? 0.05 : 0, AC.currentTime, 0.4); }
  if (k === 'auto' && v) lastInteract = rt - 8;
  syncUI();
}
function syncUI() { for (const k in TG) TG[k].checked = !!K[k]; }
function syncSliders() { for (const k in SL) { SL[k].inp.value = K[k]; SL[k].out.textContent = fmt[k](K[k]); } }
function markPreset() { for (const p in PB) PB[p].classList.toggle('act', p === preset); }
function setPreset(p) { preset = p; tween = PRESETS[p]; markPreset(); }
markPreset();
document.getElementById('bFeed').onclick = (e) => { dropFood(rr(-4, 4), rr(-1, 2), 16); e.target.blur(); };
document.getElementById('bKnock').onclick = (e) => { knockAt(rr(-0.5, 0.5), rr(-0.3, 0.2)); e.target.blur(); };
document.getElementById('bShot').onclick = (e) => { screenshot(); e.target.blur(); };
function togglePanel() { const h = panel.classList.toggle('hid'); openBtn.classList.toggle('on', h); }
openBtn.onclick = () => { togglePanel(); openBtn.blur(); };
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
  const fl = document.getElementById('flash'); fl.style.transition = 'none'; fl.style.opacity = '0.5';
  requestAnimationFrame(() => { fl.style.transition = 'opacity .6s'; fl.style.opacity = '0'; });
  window.__aqShot = url.length;
}

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const c = e.code;
  if (c === 'Space') { e.preventDefault(); togglePause(); }
  else if (c === 'KeyH') togglePanel();
  else if (c === 'Digit1' || c === 'Numpad1') setPreset('day');
  else if (c === 'Digit2' || c === 'Numpad2') setPreset('sunset');
  else if (c === 'Digit3' || c === 'Numpad3') setPreset('night');
  else if (c === 'KeyC') K.follow ? stopFollow() : startFollow(null);
  else if (c === 'Escape') stopFollow();
  else if (c === 'KeyF') dropFood(rr(-4, 4), rr(-1, 2), 16);
  else if (c === 'KeyK') knockAt(rr(-0.5, 0.5), rr(-0.3, 0.2));
  else return;
  hideHint();
});

// ------------------------------------------------------------------ pointer input: click = feed, hold = sprinkle, double-click = follow, right-click = knock
const cv = renderer.domElement, tip = document.getElementById('tip');
let down = null, clickTimer = 0, lastClick = null, sprinkleT = 0;
const ndcOf = (e, out) => out.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
const NDC = new THREE.Vector2();
cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, sprinkled: false };
  if (K.sound) audioInit();
});
cv.addEventListener('pointermove', (e) => {
  mouse.in = true; mouse.x = e.clientX; mouse.y = e.clientY; ndcOf(e, mouse.ndc);
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
});
cv.addEventListener('pointerleave', () => { mouse.in = false; tip.classList.remove('on'); });
cv.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !down) return;
  const d = down; down = null;
  if (d.moved || d.sprinkled || performance.now() - d.t > 600) return;
  ndcOf(e, NDC); const nx = NDC.x, ny = NDC.y;
  if (clickTimer && lastClick && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 14) {
    clearTimeout(clickTimer); clickTimer = 0;            // double-click: follow a fish (or feed once if nothing was hit)
    const hit = pickAt(nx, ny);
    if (hit && hit.f) startFollow(hit);
    else if (!K.follow) feedAt(nx, ny);
    lastClick = null; return;
  }
  lastClick = { x: e.clientX, y: e.clientY };
  clickTimer = setTimeout(() => { clickTimer = 0; lastClick = null; feedAt(nx, ny); hideHint(); }, 260);
});
cv.addEventListener('contextmenu', (e) => { e.preventDefault(); ndcOf(e, NDC); knockAt(NDC.x, NDC.y); hideHint(); });
cv.addEventListener('wheel', () => { lastInteract = rt; }, { passive: true });
cv.addEventListener('dblclick', (e) => e.preventDefault());

// hint & tooltip
const hintEl = document.getElementById('hint');
let hintHidden = false;
function hideHint() { if (!hintHidden) { hintHidden = true; hintEl.classList.remove('on'); } }
setTimeout(() => { if (!hintHidden) hintEl.classList.add('on'); }, 4800);
setTimeout(hideHint, 20000);
let tipFrame = 0, tipShown = null;
function updateTooltip() {
  if (++tipFrame % 5) return;
  const hit = (mouse.in && !down) ? pickAt(mouse.ndc.x, mouse.ndc.y) : null;
  const key = hit ? (hit.jelly ? 'jelly' : hit.sp.key) : null;
  if (key !== tipShown) {
    tipShown = key;
    if (hit) tip.innerHTML = hit.jelly ? 'Медуза-аурелия<i>Aurelia aurita</i>' : hit.sp.name + '<i>' + hit.sp.latin + (hit.f ? ' · двойной клик — следить' : '') + '</i>';
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
let viewOff = 0;
// keep the whole tank in frame on narrow / portrait windows by widening the vertical FOV
function fitFov() { const a = innerWidth / innerHeight; camera.fov = a < 1.75 ? Math.min(70, 2 * Math.atan(Math.tan(19 * Math.PI / 180) * 1.75 / a) * 180 / Math.PI) : 38; }
fitFov(); camera.updateProjectionMatrix();
if (innerWidth < 900) togglePanel();
function applyViewOffset() { camera.setViewOffset(innerWidth, innerHeight, viewOff, 0, innerWidth, innerHeight); camera.updateProjectionMatrix(); }
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps');
let fpsFrames = 0, fpsAcc = 0, booted = false;

// A-01: адаптивное разрешение в обе стороны, с гистерезисом. Решение — чистая функция adaptStep (без DOM и three.js);
// tests/adaptive.test.js вырезает блок между метками @pure и проверяет его в node:vm.
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
    SL.night.inp.value = K.night; SL.night.out.textContent = fmt.night(K.night);
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
    if (down && !down.moved && !down.sprinkled && performance.now() - down.t > 380) { down.sprinkled = true; clearTimeout(clickTimer); clickTimer = 0; }
    if (down && down.sprinkled && !down.moved) { sprinkleT -= rdt; if (sprinkleT <= 0) { sprinkleT = 0.07; feedAt(mouse.ndc.x, mouse.ndc.y, 2, 0.35); } }
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
  const offT = (!panel.classList.contains('hid') && innerWidth > 860) ? Math.min(120, innerWidth * 0.075) : 0;
  if (Math.abs(offT - viewOff) > 0.3) { viewOff += (offT - viewOff) * (1 - Math.exp(-rdt * 5)); applyViewOffset(); }
  if (K.sound && ambGain && K.air && Math.random() < rdt * 2.5) sfxPlopMaybe();
  // knock shake (applied only for this render)
  if (shake > 0.001) { shake *= Math.exp(-rdt * 7); SHK.set(Math.sin(rt * 90) * 0.05, Math.cos(rt * 77) * 0.035, 0).multiplyScalar(shake); camera.position.add(SHK); }
  renderer.render(scene, camera);
  if (shake > 0.001) camera.position.sub(SHK);
  if (!booted) { booted = true; window.__ok = 1; AD.t0 = performance.now(); window.__aqScreen('ready'); }
  // fps counter + adaptive resolution
  fpsFrames++; fpsAcc += rawDt;
  if (fpsAcc > 0.5) { fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + ' fps'; fpsFrames = 0; fpsAcc = 0; }
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
