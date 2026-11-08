/**
 * Akvarium — основа (A-01b): renderer, камера и OrbitControls, свет, общие uniform U, шум и ГПСЧ
 * (общее зерно seed), общий GLSL воды и patch() для материалов.
 * Тело — строки 156–324 модуля однофайловой Aquarium.html (D-13), перенесены дословно; швы — tests/split.test.js.
 * После тела — связка: reseed() и storePixelRatio(), через которые другие модули меняют seed и pixelRatio.
 * A-03: подводные поверхности (patch) — вода в линейном свете до тонмаппинга: waterLinear, causFade, uHazeK.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ------------------------------------------------------------------ basics
const W = 16, D = 8, HT = 9.0, HS = 8.4;            // tank width, depth, glass height, water surface
const BMIN = new THREE.Vector3(-W/2, -0.5, -D/2), BMAX = new THREE.Vector3(W/2, HS, D/2);
const SUN = new THREE.Vector3(0.28, 1, 0.18).normalize();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  window.__aqFail('Браузер не смог включить 3D-графику (WebGL): она не поддерживается или отключена. ' +
    'Включите аппаратное ускорение в настройках браузера или откройте страницу в другом браузере.', ['reload']);
  throw e;
}
const MAXPR = Math.min(window.devicePixelRatio || 1, 1.75);
let pixelRatio = MAXPR;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.insertBefore(renderer.domElement, document.getElementById('vignette'));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 200);
const CAM_HOME = new THREE.Vector3(0, 5.0, 22.5), TGT_HOME = new THREE.Vector3(0, 4.0, 0);
camera.position.set(0, 10.5, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TGT_HOME);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.5; controls.zoomSpeed = 0.7;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };
const LIM = { tight: { minD: 11, maxD: 30, minP: Math.PI * 0.36, maxP: Math.PI * 0.56, az: Math.PI * 0.36 },
              free:  { minD: 5, maxD: 42, minP: 0.12, maxP: Math.PI * 0.62, az: Infinity } };
function applyLimits(l) {
  controls.minDistance = l.minD; controls.maxDistance = l.maxD; controls.minPolarAngle = l.minP; controls.maxPolarAngle = l.maxP;
  controls.minAzimuthAngle = -l.az; controls.maxAzimuthAngle = l.az;
}
applyLimits(LIM.free);  // intro dolly starts outside the tight range
controls.enabled = false;
controls.update();

const hemi = new THREE.HemisphereLight(0x9fe4ff, 0x4a3a28, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.copy(SUN).multiplyScalar(20); scene.add(sun);
const fill = new THREE.DirectionalLight(0x4fa8ff, 0.5);
fill.position.set(-6, 3, 10); scene.add(fill);
const torch = new THREE.PointLight(0xc8f0ff, 0, 7.5, 1.4); torch.position.set(0, 4, 2); scene.add(torch);

// shared uniforms (same objects referenced by every material)
const U = {
  uTime: { value: 0 }, uRT: { value: 0 },
  uBoxMin: { value: BMIN }, uBoxMax: { value: BMAX },
  uDeep: { value: new THREE.Color(0x02223a) }, uShallow: { value: new THREE.Color(0x1f8fb0) },
  uSunDir: { value: SUN }, uCurrent: { value: new THREE.Vector2(1, 0) }, uDrift: { value: new THREE.Vector2(0, 0) }, uPR: { value: pixelRatio },
  uNight: { value: 0 }, uWarm: { value: 0 }, uTurb: { value: 1 }, uCaus: { value: 1 }, uCausCol: { value: new THREE.Color(0.85, 1.0, 1.0) },
  uAir: { value: 1 }, uGlowK: { value: 1 }, uHazeK: { value: 0.28 },   // A-03: brightness of the water colour (stylisation)
  uRip: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) },
  uKnock: { value: new THREE.Vector4(0, 0, 0, -100) },
};

// ------------------------------------------------------------------ noise (JS)
function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v),
           L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w) * 2 - 1;
}
function fbm(x, y, z, o = 4) { let a = 0, s = 0.5, f = 1; for (let i = 0; i < o; i++) { a += s * vnoise(x * f, y * f, z * f); f *= 2.03; s *= 0.5; } return a; }
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = THREE.MathUtils.clamp;

// ------------------------------------------------------------------ shared GLSL
const WATER_GLSL = /* glsl */`
uniform float uTime; uniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSunDir; uniform vec2 uCurrent;
uniform float uNight; uniform float uWarm; uniform float uTurb; uniform float uCaus; uniform vec3 uCausCol; uniform float uGlowK;
vec3 waterColor(float y){ float k = clamp(y / uBoxMax.y, 0.0, 1.0); return mix(uDeep, uShallow, k * k * 0.85 + k * 0.15); }
float waterPath(vec3 p){
  vec3 ro = cameraPosition; vec3 d = p - ro;
  vec3 dd = d + vec3(1e-5);
  vec3 t0 = (uBoxMin - ro) / dd, t1 = (uBoxMax - ro) / dd;
  vec3 tmin = min(t0, t1);
  float tn = clamp(max(max(tmin.x, tmin.y), tmin.z), 0.0, 1.0);
  return length(d) * (1.0 - tn);
}
vec3 waterApply(vec3 col, vec3 p){
  float path = waterPath(p) * uTurb;
  col *= exp(-path * vec3(0.10, 0.035, 0.022));
  col *= mix(0.55, 1.0, clamp(p.y / uBoxMax.y, 0.0, 1.0));
  float f = 1.0 - exp(-path * 0.085);
  return mix(col, waterColor(p.y), f);
}
// A-03: underwater surfaces (patch) in linear light, before tone mapping; waterApply above stays for the custom shaders.
// Physical part: pure-water absorption AQ_ABS at ~650/550/450 nm [1/m] (Pope & Fry 1997); scale AQ_M, 1 u ~ 0.19 m (estimate).
// Turbidity = scattering b = AQ_SCAT * uTurb [1/m], the same strength as the old haze. Stylisation: uHazeK, the brightness
// of the in-scattered water colour (art-directed uDeep/uShallow palette), not a physical quantity.
const vec3 AQ_ABS = vec3(0.34, 0.057, 0.0092);
const float AQ_M = 0.19;
const float AQ_SCAT = 0.447;
uniform float uHazeK;
vec3 waterLinear(vec3 col, vec3 p){
  float b = AQ_SCAT * uTurb;
  float d = waterPath(p) * AQ_M;
  float z = clamp(uBoxMax.y - p.y, 0.0, uBoxMax.y - uBoxMin.y) * AQ_M;
  col *= exp(-(AQ_ABS + 0.5 * b) * z);   // light that reached depth z from the surface (approximation)
  float s = 1.0 - exp(-b * d);
  return col * exp(-AQ_ABS * d) * (1.0 - s) + waterColor(p.y) * uHazeK * s;
}
// hypothesis (not measured): scattering blurs the caustic focus, so its contrast falls with depth and turbidity
float causFade(vec3 p){ return exp(-1.5 * AQ_SCAT * uTurb * max(uBoxMax.y - p.y, 0.0) * AQ_M); }
vec2 aqH22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float aqVoro(vec2 x, float t){
  vec2 n = floor(x), f = fract(x); float m1 = 8.0, m2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = aqH22(n + g); o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < m1) { m2 = m1; m1 = d; } else if (d < m2) { m2 = d; }
  }
  return sqrt(m2) - sqrt(m1);
}
float causticT(vec2 uv, float time){
  uv *= 2.2;
  uv += 0.12 * sin(uv.yx * 1.7 + time * 0.8);
  float e1 = aqVoro(uv, time), e2 = aqVoro(uv * 1.35 + 7.3, time * 1.2);
  float c1 = pow(1.0 - clamp(e1 * 2.4, 0.0, 1.0), 5.0), c2 = pow(1.0 - clamp(e2 * 2.6, 0.0, 1.0), 6.0);
  return c1 * 0.8 + c2 * 0.5 + c1 * c2 * 1.2;
}
float caustics(vec3 p, vec3 n){
  vec2 uv = p.xz + uSunDir.xz / uSunDir.y * (uBoxMax.y - p.y);
  float c = causticT(uv * 0.3, uTime * 0.7);
  float up = clamp(n.y * 0.8 + 0.2, 0.0, 1.0);
  return c * up * mix(0.45, 1.0, clamp(p.y / uBoxMax.y, 0.0, 1.0)) * uCaus;
}
float bHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bHash(i), bHash(i + vec3(1,0,0)), f.x), mix(bHash(i + vec3(0,1,0)), bHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bHash(i + vec3(0,0,1)), bHash(i + vec3(1,0,1)), f.x), mix(bHash(i + vec3(0,1,1)), bHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

// patch a MeshStandardMaterial: caustics + water volume + optional bump + custom vertex/colour code
function patch(mat, o = {}) {
  mat.onBeforeCompile = (sh) => {
    for (const k in U) sh.uniforms[k] = U[k];
    if (o.uniforms) Object.assign(sh.uniforms, o.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec2 uCurrent; uniform float uNight;\nvarying vec3 vWPos; varying vec3 vWNrm;\n' + (o.vHead || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.vert || ''))
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wpp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp;
        #endif
        wpp = modelMatrix * wpp; vWPos = wpp.xyz;
        vWNrm = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);`);
    let fs = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;\n' + WATER_GLSL + (o.fHead || ''))
      .replace('#include <color_fragment>', o.color ? o.color : '#include <color_fragment>')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * caustics(vWPos, normalize(vWNrm)) * ${(o.caustic ?? 1.0).toFixed(3)} * uCausCol * causFade(vWPos);
        ${o.emis || ''}`)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = waterLinear(gl_FragColor.rgb, vWPos);');   // A-03: linear light, before tone mapping
    if (o.near) fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (length(vViewPosition) < ' + o.near.toFixed(2) + ') discard;');
    if (o.bump) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { // procedural bump via screen-space derivatives (no textures)
        vec3 bp = vWPos * ${o.bumpFreq || '5.0'};
        float bh = bNoise(bp) * 0.65 + bNoise(bp * 2.9 + 3.1) * 0.35;
        float k = ${o.bump.toFixed(3)} * smoothstep(34.0, 12.0, length(vViewPosition));
        vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition);
        float dBx = dFdx(bh), dBy = dFdy(bh);
        vec3 R1 = cross(sY, normal), R2 = cross(normal, sX);
        float det = dot(sX, R1) * faceDirection;
        vec3 grad = sign(det) * (dBx * R1 + dBy * R2);
        normal = normalize(abs(det) * normal - k * grad);
      }`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'aq_' + (o.key || 'std');
  return mat;
}


// связка A-01b: seed и pixelRatio меняются только здесь (импортированную переменную другой модуль переназначить не может)
const reseed = s => { seed = s; };
const storePixelRatio = pr => { pixelRatio = pr; };
export { applyLimits, CAM_HOME, camera, clamp, controls, D, fbm, fill, hemi, HS, HT, LIM, MAXPR, patch, pixelRatio, renderer, reseed, rnd, rr, scene, smooth, storePixelRatio, SUN, sun, TGT_HOME, torch, U, vnoise, W, WATER_GLSL };
