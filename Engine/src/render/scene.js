/* Сцена V12: WebGL-рендерер, камера и OrbitControls, свет, студийное окружение (PMREM), фон и шоурум-пол.
 * Плоскость разреза cutPlane режет поперёк (по X): раскрывает оба 60-градусных ряда цилиндров сразу.
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
let renderer, scene, camera, controls, clock, engineRoot, keyLight, flashLight, exhaustLight;
const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100);   // сохраняет x < constant
const CAP = { uCapOn: { value: 0 }, uCapColor: { value: new THREE.Color(0xb8422b) } };

function initScene() {
  const canvas = $('scene');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    window.__engFail('Браузер не смог создать WebGL-контекст. Включите аппаратное ускорение в настройках браузера или обновите драйвер видеокарты.', ['reload']);
    throw e;
  }
  canvas.addEventListener('webglcontextlost', onContextLost, { signal: life.signal });
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
  scene.fog = new THREE.FogExp2(0x0f1218, 0.010);
  scene.environment = makeEnvironment();

  camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
  camera.position.copy(CAM_HOME);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 2.2;
  controls.maxDistance = 64;
  controls.maxPolarAngle = Math.PI * 0.93;
  controls.autoRotateSpeed = 0.7;
  controls.target.copy(TGT_HOME);
  controls.update();

  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xb2c6e2, 0x1a1510, 0.32 * GAIN));
  keyLight = new THREE.DirectionalLight(0xfff3e2, 2.05 * GAIN);
  keyLight.position.set(8.5, 14, 9.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  const sc = keyLight.shadow.camera;
  sc.near = 2; sc.far = 45; sc.left = -10.5; sc.right = 10.5; sc.top = 12; sc.bottom = -9;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.03;
  keyLight.shadow.radius = 2;
  keyLight.target.position.set(0, 1.7, 0);
  scene.add(keyLight, keyLight.target);
  const fill = new THREE.DirectionalLight(0x9cbcff, 0.34 * GAIN);
  fill.position.set(-10, 5, 8);
  const rim = new THREE.DirectionalLight(0x88e0ff, 0.92 * GAIN);
  rim.position.set(-6, 8, -11);
  scene.add(fill, rim);

  // движущаяся вспышка в камере + тёплый отблеск раскалённых коллекторов
  flashLight = new THREE.PointLight(0xff9a4a, 0, 3.6, 2);
  flashLight.position.set(0, 2.4, 0);
  exhaustLight = new THREE.PointLight(0xff5a1f, 0, 7.5, 2);
  exhaustLight.position.set(0, 2.0, 0);
  scene.add(flashLight, exhaustLight);

  buildFloor();

  engineRoot = new THREE.Group();
  scene.add(engineRoot);
}

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
  grd.addColorStop(0, '#1c222c');
  grd.addColorStop(0.55, '#12161d');
  grd.addColorStop(1, '#090b0e');
  g.fillStyle = grd; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildFloor() {
  const N = 1024, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#0e1116'; g.fillRect(0, 0, N, N);
  const cells = 48;
  for (let i = 0; i <= cells; i++) {
    const p = Math.round(i / cells * N) + 0.5;
    g.strokeStyle = i % 4 === 0 ? 'rgba(130,165,210,0.22)' : 'rgba(130,165,210,0.07)';
    g.lineWidth = i % 4 === 0 ? 1.5 : 1;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, N); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(N, p); g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const a = document.createElement('canvas');
  a.width = a.height = 256;
  const ga = a.getContext('2d');
  const rg = ga.createRadialGradient(128, 128, 12, 128, 128, 128);
  rg.addColorStop(0, '#fff'); rg.addColorStop(0.45, '#bbb'); rg.addColorStop(1, '#000');
  ga.fillStyle = rg; ga.fillRect(0, 0, 256, 256);
  const alpha = new THREE.CanvasTexture(a);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({ map, alphaMap: alpha, transparent: true, depthWrite: false,
      roughness: 0.38, metalness: 0.08, envMapIntensity: 0.55, color: 0xffffff }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  floor.renderOrder = -2;
  scene.add(floor);

  const b = document.createElement('canvas');
  b.width = b.height = 128;
  const gb = b.getContext('2d');
  const rb = gb.createRadialGradient(64, 64, 4, 64, 64, 63);
  rb.addColorStop(0, 'rgba(0,0,0,0.60)'); rb.addColorStop(0.6, 'rgba(0,0,0,0.24)'); rb.addColorStop(1, 'rgba(0,0,0,0)');
  gb.fillStyle = rb; gb.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(14, 9.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(b), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = FLOOR_Y + 0.01;
  blob.renderOrder = -1;
  scene.add(blob);
}

export { params, MAX_PR, pixelRatio, renderer, scene, camera, controls, clock, engineRoot, flashLight, exhaustLight, cutPlane, CAP, initScene, envRoom, envTarget, makeEnvironment, setLifecycle, storePixelRatio };
