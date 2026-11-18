/* Экранное затенение GTAO и выборочное HDR-свечение (bloom) для уровня качества «высокое».
 * Кадр рисуется в MSAA HalfFloat-буфер rt, затем GTAOPass переносит его на экран с AO,
 * а поверх накладывается мягкий двухпроходный bloom ярких бликов, искр, вспышек и раскалённого выпуска.
 */
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { renderer, scene, camera } from './scene.js';
import { updateShadows } from './shadows.js';

const AO = { radius: 0.5, distanceExponent: 1.3, thickness: 1.4, scale: 1.25, samples: 16, distanceFallOff: 1.0 };
const DENOISE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 };
let rt = null, gtao = null;
let bloomA = null, bloomB = null, bloomScene = null, bloomCam = null, bloomQuad = null;
let matBright = null, matBlur = null, matAdd = null;
const size = new THREE.Vector2(), fogColor = new THREE.Color(), srgb = {};

function initBloom(w, h) {
  const bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
  const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  bloomA = new THREE.WebGLRenderTarget(bw, bh, opt);
  bloomB = new THREE.WebGLRenderTarget(bw, bh, opt);
  bloomScene = new THREE.Scene();
  bloomCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  matBright = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uThresh: { value: 0.84 }, uKnee: { value: 0.16 } },
    vertexShader: vs,
    fragmentShader: `uniform sampler2D tSrc; uniform float uThresh; uniform float uKnee; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee);
        rq = (rq * rq) / (4.0 * uKnee + 1e-5);
        float w = max(rq, br - uThresh) / max(br, 1e-5);
        gl_FragColor = vec4(c * clamp(w, 0.0, 4.0), 1.0);
      }`
  });
  matBlur = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } },
    vertexShader: vs,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;
      void main(){
        vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
        s += (texture2D(tSrc, vUv + uStep * 1.384615).rgb + texture2D(tSrc, vUv - uStep * 1.384615).rgb) * 0.316216;
        s += (texture2D(tSrc, vUv + uStep * 3.230769).rgb + texture2D(tSrc, vUv - uStep * 3.230769).rgb) * 0.070270;
        gl_FragColor = vec4(s, 1.0);
      }`
  });
  matAdd = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uGain: { value: 0.32 } },
    vertexShader: vs,
    fragmentShader: `uniform sampler2D tSrc; uniform float uGain; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uGain, 1.0); }`
  });
  bloomQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matBright);
  bloomQuad.frustumCulled = false;
  bloomScene.add(bloomQuad);
}

function renderBloom() {
  if (!bloomA) return;
  const bw = bloomA.width, bh = bloomA.height;
  bloomQuad.material = matBright;
  matBright.uniforms.tSrc.value = rt.texture;
  renderer.setRenderTarget(bloomA);
  renderer.render(bloomScene, bloomCam);

  bloomQuad.material = matBlur;
  matBlur.uniforms.tSrc.value = bloomA.texture;
  matBlur.uniforms.uStep.value.set(1.3 / bw, 0);
  renderer.setRenderTarget(bloomB);
  renderer.render(bloomScene, bloomCam);

  matBlur.uniforms.tSrc.value = bloomB.texture;
  matBlur.uniforms.uStep.value.set(0, 1.3 / bh);
  renderer.setRenderTarget(bloomA);
  renderer.render(bloomScene, bloomCam);

  bloomQuad.material = matAdd;
  matAdd.uniforms.tSrc.value = bloomA.texture;
  renderer.setRenderTarget(null);
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(bloomScene, bloomCam);
  renderer.autoClear = autoClear;
}

function setAO(on) {
  if (on && !rt && renderer.capabilities.isWebGL2) {
    renderer.getDrawingBufferSize(size);
    rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    rt.isXRRenderTarget = true;
    rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    rt.depthTexture.type = THREE.UnsignedIntType;
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.setGBuffer(rt.depthTexture);
    gtao.updateGtaoMaterial(AO);
    gtao.updatePdMaterial(DENOISE);
    gtao.renderToScreen = true;
    initBloom(size.x, size.y);
  } else if (!on) disposePost();
  return aoOn();
}
const aoOn = () => rt !== null;
function renderFrame() {
  updateShadows(renderer, scene);
  if (!rt) { renderer.render(scene, camera); return; }
  renderer.getDrawingBufferSize(size);
  if (size.x !== rt.width || size.y !== rt.height) {
    rt.setSize(size.x, size.y); gtao.setSize(size.x, size.y);
    if (bloomA) { bloomA.setSize(Math.max(2, size.x >> 1), Math.max(2, size.y >> 1)); bloomB.setSize(Math.max(2, size.x >> 1), Math.max(2, size.y >> 1)); }
  }
  const fog = scene.fog;
  if (fog) { fogColor.copy(fog.color); fogColor.getRGB(srgb, THREE.SRGBColorSpace); fog.color.setRGB(srgb.r, srgb.g, srgb.b, THREE.LinearSRGBColorSpace); }
  try { renderer.setRenderTarget(rt); renderer.render(scene, camera); }
  finally { renderer.setRenderTarget(null); if (fog) fog.color.copy(fogColor); }
  let failed = null;
  renderer.info.autoReset = false;
  try { gtao.render(renderer, null, rt); renderBloom(); } catch (err) { failed = err; } finally { renderer.info.autoReset = true; }
  if (failed) {
    console.warn('AO выключен из-за ошибки:', failed);
    disposePost();
    renderer.render(scene, camera);
  }
}
function disposePost() {
  if (!rt) return;
  rt.dispose();
  gtao.dispose();
  gtao.gtaoMaterial.dispose();
  gtao.blendMaterial.dispose();
  if (bloomA) {
    bloomA.dispose(); bloomB.dispose();
    bloomQuad.geometry.dispose();
    matBright.dispose(); matBlur.dispose(); matAdd.dispose();
  }
  rt = gtao = bloomA = bloomB = bloomScene = bloomCam = bloomQuad = matBright = matBlur = matAdd = null;
}

export { setAO, aoOn, renderFrame, disposePost };
