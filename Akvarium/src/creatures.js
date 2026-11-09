/**
 * Akvarium — обитатели (A-01b): геометрия и материалы рыб, окружение ENV (PMREM), виды SPECIES, стаи,
 * пузыри аэратора, медузы.
 * Тело — строки 915–1186 модуля однофайловой Aquarium.html (D-13), перенесены дословно; швы — tests/split.test.js.
 * Шов: seed = 2024 → reseed(2024). После тела — связка storeEnv(): main.js строит ENV заново после потери контекста.
 */
import * as THREE from 'three';
import { HS, patch, renderer, reseed, rnd, rr, scene, smooth, U } from './core.js';
import { AERATOR, ANEMONES } from './scenery.js';

// ------------------------------------------------------------------ fish geometry
function fishGeo(o) {
  const L = o.L, H = o.H, Wd = o.W, pos = [], fin = [], idx = [];
  const NS = o.L < 0.7 ? 18 : 26, NR = o.L < 0.7 ? 12 : 16;
  const prof = (s) => { let f = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(s, o.pw || 0.62)), 0), 0.7); return Math.max(f, (o.ped || 0.12) * smooth(0.55, 1.0, s)); };
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, z = L / 2 - s * L, f = prof(s);
    for (let j = 0; j < NR; j++) {
      const a = j / NR * Math.PI * 2;
      const cy = Math.cos(a), sx = Math.sin(a);
      const belly = cy < 0 ? (o.belly || 1.0) : 1.0;
      pos.push(sx * Wd / 2 * f, cy * H / 2 * f * belly + (o.yoff || 0) * f * H, z); fin.push(0);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
    const a = i * NR + j, b = i * NR + (j + 1) % NR, c = a + NR, d = b + NR;
    idx.push(a, c, b, b, c, d);
  }
  const grid = (nu, nv, fn, fv) => {
    const base = pos.length / 3;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = fn(i / nu, j / nv); pos.push(p[0], p[1], p[2]); fin.push(fv); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = base + i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  };
  const zb = -L / 2 + 0.02 * L, ph = (o.ped || 0.12) * H / 2;
  // tail
  grid(6, 8, (u, v) => {
    const vv = v * 2 - 1, edge = 1 - (o.fork || 0.3) * (1 - Math.abs(vv)) - (o.round || 0) * (Math.abs(vv) ** 2);
    const z = zb - u * o.tail * edge, y = vv * (ph + (o.tailH / 2 - ph) * Math.pow(u, 0.8));
    return [0, y, z];
  }, 1);
  // dorsal & anal fins
  const finAlong = (s0, s1, h, sign, sweep) => grid(10, 3, (u, v) => {
    const s = s0 + (s1 - s0) * u, z = L / 2 - s * L, f = prof(s);
    const top = sign * (H / 2 * f * (sign < 0 ? (o.belly || 1) : 1)) + (o.yoff || 0) * f * H;
    const sh = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.0)), 0.6) * (o.finShape ? o.finShape(u) : 1);
    return [0, top - sign * 0.02 * H + sign * v * h * sh, z - v * sweep * L * sh];
  }, 1);
  finAlong(o.d0, o.d1, o.dH, 1, o.dSweep || 0.15);
  if (o.aH) finAlong(o.a0, o.a1, o.aH, -1, o.aSweep || 0.12);
  // pectoral fins
  for (const sd of [-1, 1]) grid(3, 2, (u, v) => {
    const zz = L / 2 - (0.28 + u * 0.16) * L, f = prof(0.3);
    return [sd * (Wd / 2 * f * 0.9 + v * 0.05 * L), -0.05 * H - v * 0.12 * H + u * 0.02 * H, zz - v * 0.06 * L];
  }, 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const FISH_VERT = `
  vLp = position; vFin = aFin;
  float s = (uHalfL - position.z) / uLen;
  vS = s;
  float env = 0.05 + 0.75 * s * s;
  float w = sin(s * 4.2 - aPhase);
  transformed.x += w * env * uAmp * uLen;
  if (aFin > 1.5) transformed.x += sign(position.x) * (0.5 + 0.5 * sin(aPhase * 0.7 + 1.0)) * 0.08 * uLen * abs(position.z - (uHalfL - 0.28 * uLen)) / (0.16 * uLen);
`;
const FISH_FRAG_HEAD = `varying vec3 vLp; varying float vFin; varying float vS; uniform float uHalfL; uniform float uLen; uniform float uH;`;
const FISH_VERT_HEAD = `attribute float aPhase; attribute float aFin; varying vec3 vLp; varying float vFin; varying float vS; uniform float uHalfL; uniform float uLen; uniform float uAmp; uniform float uH;`;
const EYE = `
  { vec2 ec = vec2(uHalfL - 0.14 * uLen, 0.06 * uH); float er = 0.05 * uLen * EYES;
    float d = length(vec2(vLp.z, vLp.y) - ec);
    if (vFin < 0.5) { col = mix(col, vec3(0.85, 0.75, 0.4), smoothstep(er * 1.25, er * 1.1, d)); col = mix(col, vec3(0.01), smoothstep(er, er * 0.85, d));
      col = mix(col, vec3(1.0), smoothstep(er * 0.32, er * 0.2, length(vec2(vLp.z, vLp.y) - ec - vec2(er * 0.3, er * 0.35)))); irid *= step(er * 1.3, d); }
  }`;
// tiny procedural environment map for glossy fish (gradient sky + sun blob), prefiltered with PMREM.
// A-01: результат PMREM — рендер в текстуру, после восстановления WebGL-контекста его строим заново (makeEnv)
function makeEnv() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#d8f6ff'); gr.addColorStop(0.42, '#2f8fa8'); gr.addColorStop(1, '#03121a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  const rg = g.createRadialGradient(80, 18, 0, 80, 18, 56); rg.addColorStop(0, 'rgba(255,250,232,.95)'); rg.addColorStop(1, 'rgba(255,250,232,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer), e = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); return e;
}
let ENV = makeEnv();
const FISH_MATS = [];
function fishMaterial(key, pattern, dims, eyes = 1.0) {
  const uniforms = { uHalfL: { value: dims.L / 2 }, uLen: { value: dims.L }, uAmp: { value: dims.amp }, uH: { value: dims.H } };
  const mat = patch(new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.12, side: THREE.DoubleSide, envMap: ENV, envMapIntensity: 0.55 }), {
    key: 'fish_' + key, uniforms, caustic: 0.45, near: 0.35,
    vHead: FISH_VERT_HEAD, vert: FISH_VERT, fHead: FISH_FRAG_HEAD + '\nvarying float vIrid;\n#define EYES ' + eyes.toFixed(2),
    color: `
      vec3 col = vec3(1.0); float irid = 0.0; float yN = vLp.y / (0.5 * uH); float fScale = 0.0;
      ${pattern}
      if (vFin < 0.5) {   // overlapping scales + countershading
        vec2 sp = vec2(vLp.z, vLp.y) / uLen * 30.0; sp.y += 0.5 * mod(floor(sp.x), 2.0);
        vec2 cc = fract(sp) - 0.5; float sc = smoothstep(0.55, 0.12, length(cc - vec2(0.2, 0.0)));
        fScale = sc;   // A-03 step 3: scale centres, reused for roughness and sheen
        col *= (0.88 + 0.14 * sc) * mix(1.16, 0.84, smoothstep(-1.0, 1.0, yN));   // A-03 step 3: stronger countershading (pale belly, darker back)
      } else {            // fin rays
        col *= 0.8 + 0.2 * sin((vLp.y * 1.3 + vLp.z * 0.4) / uLen * 90.0);
      }
      ${EYE}
      #ifdef USE_INSTANCING_COLOR
        col *= vColor;
      #endif
      diffuseColor.rgb = col;
      float fIrid = irid;
    `,
    rough: `
      roughnessFactor = vFin > 0.5 ? 0.42 : mix(0.40, 0.17, fScale);   // A-03 step 3: glossy scale centres catch sun glints
    `,
    emis: `
      { vec3 vd = normalize(vViewPosition); float fr = 1.0 - abs(dot(normal, vd));
        // A-03 step 3: guanine sheen - less rainbow, more silver; strongest at grazing angles and on scale centres
        vec3 ir = mix(vec3(0.85, 0.92, 1.0), 0.5 + 0.5 * cos(6.2831 * (fr * 1.4 + vec3(0.0, 0.33, 0.67) + vLp.z * 0.5)), 0.65);
        totalEmissiveRadiance += ir * fIrid * (0.25 + 0.9 * fr * fr) * (0.75 + 0.5 * fScale) * 0.5;
        // A-03 step 3: thin fins transmit the refracted sun (back-lit glow, dims with the light colour at night)
        vec3 Vw = normalize(cameraPosition - vWPos), Sw = causSun(), Nw = normalize(vWNrm); Nw = dot(Nw, Vw) < 0.0 ? -Nw : Nw;
        float tr = 0.6 * max(dot(-Nw, Sw), 0.0) + 0.4 * pow(max(dot(-Vw, Sw), 0.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * (vFin > 0.5 ? 0.15 + 0.55 * tr * uCausCol : vec3(0.06));
        totalEmissiveRadiance += mix(vec3(0.15, 0.4, 0.55), vec3(0.25, 0.55, 1.0), uNight) * fr * fr * fr * (0.35 + 0.4 * uNight); }
    `
  });
  FISH_MATS.push(mat); return mat;
}

// species
const SPECIES = [];
function species(def) {
  const g = fishGeo(def.geo);
  const ph = new THREE.InstancedBufferAttribute(new Float32Array(def.n), 1); ph.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aPhase', ph);
  const mesh = new THREE.InstancedMesh(g, fishMaterial(def.key, def.pattern, { L: def.geo.L, H: def.geo.H, amp: def.amp }, def.eyes || 1), def.n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const c = new THREE.Color();
  const fish = [];
  for (let i = 0; i < def.n; i++) {
    c.setHSL(0, 0, 1).multiplyScalar(rr(0.85, 1.1)); mesh.setColorAt(i, c);
    const p = new THREE.Vector3(rr(-6, 6), rr(2.5, 7), rr(-2.5, 2.5));
    if (def.home) p.copy(def.home).add(new THREE.Vector3(rr(-0.6, 0.6), rr(0.3, 0.8), rr(-0.6, 0.6)));
    const v = new THREE.Vector3(rr(-1, 1), rr(-0.1, 0.1), rr(-1, 1)).normalize().multiplyScalar(def.speed[0]);
    fish.push({ p, v, dir: v.clone().normalize(), bank: 0, phase: rnd() * 6.28, scale: def.scale * rr(0.85, 1.15), target: p.clone(), tt: 0, food: null, st: 0, cd: 0, hide: 0, boost: 1, sp: null });
  }
  scene.add(mesh);
  const sp = Object.assign({ mesh, fish, ph, count: def.n }, def);
  if (def.school) { sp.count = Math.round(def.n * def.def); mesh.count = sp.count; }
  SPECIES.push(sp); return sp;
}
reseed(2024);
const chromis = species({
  key: 'chromis', n: 150, def: 0.6, school: true, name: 'Хромис зелёный', latin: 'Chromis viridis', speed: [0.9, 2.0], scale: 1, amp: 0.09, freq: 9,
  geo: { L: 0.42, H: 0.17, W: 0.07, tail: 0.13, tailH: 0.17, fork: 0.55, d0: 0.25, d1: 0.78, dH: 0.05, a0: 0.55, a1: 0.8, aH: 0.04 },
  pattern: `
    col = mix(vec3(0.62, 1.0, 0.86), vec3(0.08, 0.78, 0.70), smoothstep(-0.7, 0.5, yN));
    col = mix(col, vec3(0.02, 0.42, 0.62), smoothstep(0.4, 1.0, yN));
    if (vFin > 0.5) col = vec3(0.4, 0.9, 0.95);
    irid = vFin > 0.5 ? 0.12 : 0.32;`
});
const anthias = species({
  key: 'anthias', n: 76, def: 0.6, school: true, name: 'Антиас золотистый', latin: 'Pseudanthias squamipinnis', speed: [0.8, 1.8], scale: 1, amp: 0.1, freq: 8,
  geo: { L: 0.55, H: 0.2, W: 0.08, tail: 0.2, tailH: 0.24, fork: 0.75, d0: 0.2, d1: 0.82, dH: 0.07, a0: 0.55, a1: 0.82, aH: 0.06 },
  pattern: `
    col = mix(vec3(1.0, 0.72, 0.30), vec3(1.0, 0.36, 0.42), smoothstep(-0.6, 0.7, yN));
    float st = 1.0 - smoothstep(0.0, 0.035 * uLen, abs(vLp.y + (vS - 0.12) * uH * 0.9));
    col = mix(col, vec3(0.75, 0.55, 1.0), st * step(0.08, vS) * step(vS, 0.38) * step(vFin, 0.5));
    if (vFin > 0.5) col = mix(vec3(1.0, 0.6, 0.2), vec3(1.0, 0.3, 0.6), smoothstep(1.0, 1.4, vS));
    irid = 0.2;`
});
const clowns = species({
  key: 'clown', n: 3, name: 'Рыба-клоун', latin: 'Amphiprion ocellaris', speed: [0.3, 0.8], scale: 1, amp: 0.13, freq: 11, home: new THREE.Vector3(ANEMONES[0].x, ANEMONES[0].y + 0.9, ANEMONES[0].z),
  geo: { L: 0.62, H: 0.27, W: 0.14, tail: 0.15, tailH: 0.24, fork: -0.1, round: 0.3, d0: 0.25, d1: 0.82, dH: 0.09, a0: 0.6, a1: 0.85, aH: 0.07, ped: 0.18, pw: 0.7 },
  pattern: `
    col = vec3(1.0, 0.40, 0.04);
    float b = 0.0, k = 0.0;
    for (int i = 0; i < 3; i++) { float c = i == 0 ? 0.24 : (i == 1 ? 0.52 : 0.86); float w = i == 1 ? 0.07 : 0.05; float dd = abs(vS - c);
      b = max(b, smoothstep(w, w * 0.8, dd)); k = max(k, smoothstep(w + 0.03, w + 0.02, dd)); }
    col = mix(col, vec3(0.02), k * (1.0 - b)); col = mix(col, vec3(1.0, 0.98, 0.95), b);
    if (vFin > 0.5) { col = mix(vec3(1.0, 0.45, 0.05), vec3(0.03), smoothstep(1.12, 1.22, vS) + step(0.5, vFin) * smoothstep(0.08, 0.14, abs(abs(yN) - 1.0)) * 0.0); }
    irid = 0.05;`
});
const tangs = species({
  key: 'tang', n: 2, name: 'Голубой хирург', latin: 'Paracanthurus hepatus', speed: [0.5, 1.2], scale: 1, amp: 0.08, freq: 6,
  geo: { L: 1.3, H: 0.78, W: 0.17, tail: 0.32, tailH: 0.55, fork: 0.25, d0: 0.18, d1: 0.9, dH: 0.12, a0: 0.45, a1: 0.9, aH: 0.1, ped: 0.11, pw: 0.6 },
  pattern: `
    col = vec3(0.08, 0.30, 0.95);
    float curve = 0.38 - 1.6 * (vS - 0.55) * (vS - 0.55);
    float pal = smoothstep(0.17, 0.12, abs(yN - curve)) * smoothstep(0.1, 0.2, vS) * smoothstep(1.0, 0.85, vS);
    float loopb = smoothstep(0.22, 0.17, length(vec2((vS - 0.62) * 2.0, yN + 0.05))) - smoothstep(0.12, 0.08, length(vec2((vS - 0.62) * 2.0, yN + 0.05)));
    col = mix(col, vec3(0.01, 0.02, 0.05), clamp(pal + loopb, 0.0, 1.0));
    if (vFin > 0.5) col = vec3(0.05, 0.2, 0.75);
    if (vS > 1.02 && vFin > 0.5) col = vec3(1.0, 0.82, 0.08);
    irid = 0.3;`
});
const ytang = species({
  key: 'ytang', n: 2, name: 'Жёлтый хирург', latin: 'Zebrasoma flavescens', speed: [0.5, 1.1], scale: 1, amp: 0.08, freq: 6,
  geo: { L: 1.05, H: 0.82, W: 0.14, tail: 0.26, tailH: 0.48, fork: 0.0, round: 0.1, d0: 0.15, d1: 0.9, dH: 0.18, a0: 0.4, a1: 0.9, aH: 0.16, ped: 0.11, pw: 0.66 },
  pattern: `
    col = vec3(1.0, 0.82, 0.05);
    col = mix(col, vec3(1.0), smoothstep(0.035, 0.02, length(vec2(vS - 0.93, yN * 0.05))) );
    if (vFin > 0.5) col = vec3(1.0, 0.86, 0.15);
    irid = 0.08;`
});
const idols = species({
  key: 'idol', n: 1, name: 'Мавританский идол', latin: 'Zanclus cornutus', speed: [0.45, 1.0], scale: 1, amp: 0.07, freq: 5,
  geo: { L: 0.95, H: 0.8, W: 0.12, tail: 0.22, tailH: 0.42, fork: 0.35, d0: 0.15, d1: 0.55, dH: 0.95, dSweep: 0.55, a0: 0.42, a1: 0.8, aH: 0.25, ped: 0.1, pw: 0.45,
         finShape: (u) => 1 - 0.0 * u },
  pattern: `
    col = vec3(0.98, 0.95, 0.85);
    float x = vS;
    float b1 = smoothstep(0.03, 0.0, abs(x - 0.30) - 0.06);
    float b2 = smoothstep(0.03, 0.0, abs(x - 0.70) - 0.09);
    col = mix(col, vec3(1.0, 0.85, 0.2), smoothstep(0.08, 0.0, abs(x - 0.85) - 0.04) * step(vFin, 0.5));
    col = mix(col, vec3(0.03), max(b1, b2));
    if (vFin > 0.5 && vLp.y > 0.45 * uH) col = mix(vec3(0.03), vec3(0.98), smoothstep(0.4, 0.9, vLp.y / uH));
    if (vS > 1.05) col = vec3(0.04);
    if (vS < 0.12 && vFin < 0.5) col = mix(col, vec3(1.0, 0.6, 0.1), 0.7);
    irid = 0.05;`, eyes: 0.9
});


// ------------------------------------------------------------------ bubbles (aerator can be switched off: no new bubbles spawn, the last ones rise and fade)
const BUB_N = 120;
const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uSky: U.uSky, uNight: U.uNight },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uSky; uniform float uNight; varying vec3 vN; varying vec3 vV; void main(){ vec3 v = normalize(vV); vec3 n = normalize(vN); float f = 1.0 - abs(dot(v, n));
    float rim = pow(f, 2.5); float spec = pow(max(dot(reflect(-v, n), normalize(vec3(0.3, 1.0, 0.4))), 0.0), 40.0);
    vec3 tint = mix(vec3(0.75, 0.95, 1.0), uSky, 0.5) * (1.0 - 0.55 * uNight);
    vec3 c = tint * (rim * 1.1 + 0.08) + spec * 1.5 * tint; gl_FragColor = vec4(c, clamp(rim * 0.85 + 0.06 + spec, 0.0, 1.0)); }`
}), BUB_N);
bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bubbles.frustumCulled = false; bubbles.renderOrder = 7;
scene.add(bubbles);
const bub = [];
for (let i = 0; i < BUB_N; i++) bub.push({ y: rr(AERATOR.y, HS), r: rr(0.025, 0.08), ph: rnd() * 6.28, ox: rr(-0.1, 0.1), oz: rr(-0.1, 0.1), sp: 0, dead: false, wait: 0 });
bub.forEach(b => b.sp = 0.9 + b.r * 9);

// ------------------------------------------------------------------ jellyfish (moon jellies with radial canals; they glow at night)
const jellies = [];
{
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * Math.PI * 0.5; pts.push(new THREE.Vector2(Math.sin(a) * (1 + 0.08 * t), Math.cos(a) * 0.7 - 0.1 * t * t)); }
  const bellG = new THREE.LatheGeometry(pts, 48);
  const JCOL = [[new THREE.Color(0.55, 0.72, 1.0), new THREE.Color(1.0, 0.5, 0.85)],
                [new THREE.Color(0.75, 0.6, 1.0), new THREE.Color(0.55, 0.9, 1.0)],
                [new THREE.Color(0.5, 0.95, 1.0), new THREE.Color(1.0, 0.75, 0.45)]];
  const TN = 16, SEG = 18;
  for (let j = 0; j < 3; j++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPulse: { value: 0 }, uCol: { value: JCOL[j][0] }, uGon: { value: JCOL[j][1] }, uNight: U.uNight, uTime: U.uTime, uBoxMin: U.uBoxMin, uBoxMax: U.uBoxMax },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uPulse; varying vec3 vN; varying vec3 vP; varying vec3 vL;
        void main(){ vec3 p = position; float r = length(p.xz); float k = 1.0 - 0.2 * uPulse * smoothstep(0.2, 1.0, r); p.xz *= k; p.y *= 1.0 + 0.14 * uPulse;
          p.y -= 0.05 * sin(atan(p.z, p.x) * 16.0) * smoothstep(0.85, 1.05, r);   // scalloped margin
          vL = position; vec4 w = modelMatrix * vec4(p, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uCol; uniform vec3 uGon; uniform float uNight; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vL;
        void main(){ vec3 v = normalize(cameraPosition - vP); float f = 1.0 - abs(dot(v, normalize(vN)));
          float a = atan(vL.z, vL.x), r = length(vL.xz);
          float gon = smoothstep(0.12, 0.0, abs(length(vec2(r * cos(a * 2.0), r * sin(a * 2.0)) - vec2(0.38, 0.0)) - 0.12)) * smoothstep(0.65, 0.2, r);
          float canal = smoothstep(0.85, 1.0, abs(sin(a * 8.0))) * smoothstep(0.15, 0.6, r) * 0.6;
          float rimGlow = smoothstep(0.82, 1.02, r);
          float glow = 1.0 + 2.4 * uNight;
          float wave = 0.75 + 0.25 * sin(r * 10.0 - uTime * 2.5);
          vec3 c = uCol * (pow(f, 1.8) * 0.45 + 0.03 + canal * 0.08 + rimGlow * 0.14 * wave) + uGon * gon * 0.35;
          c += uCol * uNight * (rimGlow * 0.5 * wave + canal * 0.25);
          c *= smoothstep(1.2, 0.95, r) * glow * 0.85;
          gl_FragColor = vec4(c, 1.0); }`
    });
    const m = new THREE.Mesh(bellG, mat); m.renderOrder = 8; scene.add(m);
    const lg = new THREE.BufferGeometry(); const arr = new Float32Array(TN * SEG * 2 * 3);
    lg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const lmat = new THREE.LineBasicMaterial({ color: JCOL[j][0].clone().lerp(new THREE.Color(1, 1, 1), 0.3), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lg, lmat);
    lines.frustumCulled = false; lines.renderOrder = 8; scene.add(lines);
    const s = [0.5, 0.38, 0.3][j];
    const tent = []; for (let t = 0; t < TN; t++) { const a = t / TN * 6.28; const ch = []; for (let k = 0; k < SEG; k++) ch.push(new THREE.Vector3()); tent.push({ a, ch, len: rr(1.4, 2.4) * s }); }
    const jp = new THREE.Vector3([-1.5, 4.5, 1.8][j], [5.4, 6.2, 4.4][j], [1.0, 0.5, -0.6][j]);
    tent.forEach(t => t.ch.forEach((c, k) => c.set(jp.x + Math.cos(t.a) * s, jp.y - k * 0.1, jp.z + Math.sin(t.a) * s)));
    jellies.push({ m, lines, lmat, arr, tent, s, p: jp, v: new THREE.Vector3(), t: rnd() * 5, drift: new THREE.Vector3(rr(-1, 1), 0, rr(-1, 1)).normalize(), nextDrift: rr(10, 20) });
  }
}


// связка A-01b: после восстановления WebGL-контекста main.js строит окружение рыб заново
const storeEnv = env => { ENV = env; };
export { anthias, bub, BUB_N, bubbles, chromis, clowns, ENV, FISH_MATS, idols, jellies, makeEnv, SPECIES, storeEnv, tangs, ytang };
