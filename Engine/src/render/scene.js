/* Сцена: WebGL-рендерер, камера и OrbitControls, свет, окружение (PMREM), фон и пол.
 * M-02b: раздел 4 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * life и обработчики потери и восстановления контекста остаются в main.js (раздел 11): main.js передаёт их
 * через setLifecycle() при загрузке, до вызова initScene(). Адаптивное разрешение в main.js меняет pixelRatio
 * через storePixelRatio().
 * M-07a: студийный свет и окружение — StudioEnvironment из render/studio.js вместо RoomEnvironment; яркости
 * источников умножены на GAIN, экспозиция прежняя (почему — в studio.js); тени чуть резче (radius 2).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FLOOR_Y, CAM_HOME, TGT_HOME, $ } from './world.js';
import { GAIN, StudioEnvironment } from './studio.js';

let life, onContextLost, onContextRestored;
const setLifecycle = (ctl, lost, restored) => { life = ctl; onContextLost = lost; onContextRestored = restored; };
const storePixelRatio = pr => { pixelRatio = pr; };

const params = new URLSearchParams(location.search);
const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.75);
let pixelRatio = MAX_PR;
let renderer, scene, camera, controls, clock, engineRoot, keyLight, flashLight;
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);   // keeps z < constant
const CAP = { uCapOn: { value: 0 }, uCapColor: { value: new THREE.Color(0xa9452f) } };

function initScene() {
  const canvas = $('scene');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    window.__engFail('Браузер не смог создать WebGL-контекст. Включите аппаратное ускорение в настройках браузера или обновите драйвер видеокарты.', ['reload']);
    throw e;
  }
  canvas.addEventListener('webglcontextlost', onContextLost, { signal: life.signal });   // M-03; обработчики three.js стоят раньше
  canvas.addEventListener('webglcontextrestored', onContextRestored, { signal: life.signal });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  scene = new THREE.Scene();
  scene.background = makeBackground();
  scene.fog = new THREE.FogExp2(0x101318, 0.012);
  scene.environment = makeEnvironment();

  camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
  camera.position.copy(CAM_HOME);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 2.0;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.93;
  controls.autoRotateSpeed = 0.7;
  controls.target.copy(TGT_HOME);
  controls.update();

  clock = new THREE.Clock();

  // light: soft sky/ground + warm key with shadows + cool fill + cyan rim (M-07a: studio levels × GAIN)
  scene.add(new THREE.HemisphereLight(0xa9bcd6, 0x1b1712, 0.30 * GAIN));
  keyLight = new THREE.DirectionalLight(0xfff1e0, 1.9 * GAIN);
  keyLight.position.set(7, 12, 7.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  const sc = keyLight.shadow.camera;
  sc.near = 2; sc.far = 40; sc.left = -9; sc.right = 9; sc.top = 11; sc.bottom = -8;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.03;
  keyLight.shadow.radius = 2;
  keyLight.target.position.set(0, 1.5, 0);
  scene.add(keyLight, keyLight.target);
  const fill = new THREE.DirectionalLight(0x9cbcff, 0.30 * GAIN);
  fill.position.set(-9, 4, 6);
  const rim = new THREE.DirectionalLight(0x7fdcff, 0.85 * GAIN);
  rim.position.set(-5, 7, -10);
  scene.add(fill, rim);
  // single moving combustion light (always present → no shader recompiles)
  flashLight = new THREE.PointLight(0xff9a4a, 0, 3.2, 2);
  flashLight.position.set(0, 2.3, 0);
  scene.add(flashLight);

  buildFloor();

  engineRoot = new THREE.Group();
  scene.add(engineRoot);
}

/* окружение — результат рендера на GPU (PMREM); после потери контекста его нужно построить заново */
let envRoom = null, envTarget = null;
function makeEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  envRoom = new StudioEnvironment();
  envTarget = pmrem.fromScene(envRoom, 0.02);
  pmrem.dispose();
  return envTarget.texture;
}

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#1b2029');
  grd.addColorStop(0.55, '#13161c');
  grd.addColorStop(1, '#0a0b0e');
  g.fillStyle = grd; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildFloor() {
  // procedural floor: fine grid + radial fade baked into a canvas (one texture, one draw call)
  const N = 1024, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#0f1216'; g.fillRect(0, 0, N, N);
  const cells = 48;
  for (let i = 0; i <= cells; i++) {
    const p = Math.round(i / cells * N) + 0.5;
    g.strokeStyle = i % 4 === 0 ? 'rgba(120,150,190,0.22)' : 'rgba(120,150,190,0.08)';
    g.lineWidth = i % 4 === 0 ? 1.4 : 1;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, N); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(N, p); g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const a = document.createElement('canvas');
  a.width = a.height = 256;
  const ga = a.getContext('2d');
  const rg = ga.createRadialGradient(128, 128, 10, 128, 128, 128);
  rg.addColorStop(0, '#fff'); rg.addColorStop(0.45, '#bbb'); rg.addColorStop(1, '#000');
  ga.fillStyle = rg; ga.fillRect(0, 0, 256, 256);
  const alpha = new THREE.CanvasTexture(a);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44),
    new THREE.MeshStandardMaterial({ map, alphaMap: alpha, transparent: true, depthWrite: false,
      roughness: 0.62, metalness: 0.0, envMapIntensity: 0.35, color: 0xffffff }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  floor.renderOrder = -2;
  scene.add(floor);

  // soft contact-shadow blob (ambient occlusion feel under the engine)
  const b = document.createElement('canvas');
  b.width = b.height = 128;
  const gb = b.getContext('2d');
  const rb = gb.createRadialGradient(64, 64, 4, 64, 64, 63);
  rb.addColorStop(0, 'rgba(0,0,0,0.55)'); rb.addColorStop(0.6, 'rgba(0,0,0,0.22)'); rb.addColorStop(1, 'rgba(0,0,0,0)');
  gb.fillStyle = rb; gb.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(11, 7),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(b), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = FLOOR_Y + 0.01;
  blob.renderOrder = -1;
  scene.add(blob);
}

export { params, MAX_PR, pixelRatio, renderer, scene, camera, controls, clock, engineRoot, flashLight, cutPlane, CAP, initScene, envRoom, envTarget, makeEnvironment, setLifecycle, storePixelRatio };
