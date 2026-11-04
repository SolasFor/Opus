/* Экранное затенение GTAO (M-07a) для уровня качества «высокое»; уровень выбирает render/quality.js.
 * Кадр рисуется в буфер rt теми же шейдерами, что и на экран: буфер помечен isXRRenderTarget, поэтому three.js
 * применяет к нему тональную компрессию и sRGB-кодирование, как к холсту, а формат HalfFloat не перекодирует
 * цвет при записи. Затем GTAOPass копирует кадр на экран и умножает на AO. EffectComposer и OutputPass не нужны:
 * цвета фона, штриховки сечения, свечения и частиц остаются прежними (OutputPass в прототипе M-07 их сдвигал).
 * GTAO берёт глубину основного прохода (setGBuffer), поэтому разрез и рентген учитываются как в кадре; нормали
 * восстанавливаются по глубине. Цвет тумана three.js передаёт в буфер в линейном пространстве, а на экран —
 * в sRGB: на время прохода в буфер цвет подменяется, чтобы туман совпал.
 * Без AO — прежний renderer.render(), буферы AO не создаются. Счётчики renderer.info (engine.stats()), как и раньше,
 * считают основной проход кадра без теней; с AO к ним добавляются четыре полноэкранных прохода GTAO.
 */
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { renderer, scene, camera } from './scene.js';

const AO = { radius: 0.5, distanceExponent: 1.3, thickness: 1.4, scale: 1.25, samples: 16, distanceFallOff: 1.0 };
const DENOISE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 };
let rt = null, gtao = null;
const size = new THREE.Vector2(), fogColor = new THREE.Color(), srgb = {};

/* включает и выключает AO (после initScene()); без WebGL2 (нет MSAA-буферов и текстуры глубины) AO не включается */
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
  } else if (!on) disposePost();
  return aoOn();
}
const aoOn = () => rt !== null;
function renderFrame() {
  if (!rt) { renderer.render(scene, camera); return; }
  renderer.getDrawingBufferSize(size);
  if (size.x !== rt.width || size.y !== rt.height) { rt.setSize(size.x, size.y); gtao.setSize(size.x, size.y); }
  const fog = scene.fog;
  if (fog) { fogColor.copy(fog.color); fogColor.getRGB(srgb, THREE.SRGBColorSpace); fog.color.setRGB(srgb.r, srgb.g, srgb.b, THREE.LinearSRGBColorSpace); }
  try { renderer.setRenderTarget(rt); renderer.render(scene, camera); }
  finally { renderer.setRenderTarget(null); if (fog) fog.color.copy(fogColor); }
  renderer.info.autoReset = false;          // проходы GTAO добавляются к счётчикам основного прохода
  try { gtao.render(renderer, null, rt); } finally { renderer.info.autoReset = true; }
}
/* GTAOPass.dispose() в three.js 0.160 не освобождает два своих материала */
function disposePost() {
  if (!rt) return;
  rt.dispose();
  gtao.dispose();
  gtao.gtaoMaterial.dispose();
  gtao.blendMaterial.dispose();
  rt = gtao = null;
}

export { setAO, aoOn, renderFrame, disposePost };
