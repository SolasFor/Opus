/* Материалы деталей M и корпусные материалы с плоскостью разреза и штриховкой сечения (makeHousing).
 * M-02b: раздел 5 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 */
import * as THREE from 'three';
import { cutPlane, CAP } from './scene.js';

let M;
function stripeTexture(draw, w = 256, h = 16) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function createMaterials() {
  const std = o => new THREE.MeshStandardMaterial(o);
  // exhaust heat tint along the runner (u = 0 at the port): straw → bronze → blue → steel
  const heatTint = stripeTexture((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#b98d5a'); gr.addColorStop(0.18, '#a9764c'); gr.addColorStop(0.34, '#6e5a86');
    gr.addColorStop(0.5, '#5b6f92'); gr.addColorStop(0.75, '#8c939b'); gr.addColorStop(1, '#9aa0a6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const heatGlow = stripeTexture((g, w, h) => {      // emissive map: glows near the port first
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#9a9a9a'); gr.addColorStop(1, '#2a2a2a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  // timing belt: tooth stripes along u
  const beltTex = stripeTexture((g, w, h) => {
    g.fillStyle = '#17191c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2e33'; g.fillRect(0, 0, w * 0.5, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(w * 0.5, 0, w * 0.06, h);
  }, 64, 8);
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;

  M = {
    iron:     std({ color: 0x4a5059, metalness: 0.55, roughness: 0.62 }),
    alu:      std({ color: 0x9aa2ac, metalness: 0.80, roughness: 0.42 }),
    aluCast:  std({ color: 0x8a929c, metalness: 0.70, roughness: 0.55 }),
    aluLight: std({ color: 0xc3cad2, metalness: 0.85, roughness: 0.30 }),
    aluDark:  std({ color: 0x5f6771, metalness: 0.80, roughness: 0.50 }),
    steel:    std({ color: 0xb3bbc4, metalness: 0.95, roughness: 0.22 }),
    steelDark:std({ color: 0x5d646d, metalness: 0.90, roughness: 0.38 }),
    chrome:   std({ color: 0xe4e9ef, metalness: 1.00, roughness: 0.08 }),
    brass:    std({ color: 0xc8a24b, metalness: 0.92, roughness: 0.30 }),
    rings:    std({ color: 0x1d2127, metalness: 0.85, roughness: 0.35 }),
    ceramic:  std({ color: 0xf1f0ea, metalness: 0.0, roughness: 0.38 }),
    gasket:   std({ color: 0x6b7178, metalness: 0.75, roughness: 0.45 }),
    valve:    std({ color: 0xbf9566, metalness: 0.90, roughness: 0.32 }),
    cam:      std({ color: 0xa8b1bb, metalness: 0.95, roughness: 0.18 }),
    dark:     std({ color: 0x1a1d22, metalness: 0.50, roughness: 0.70 }),
    soot:     std({ color: 0x2a2724, metalness: 0.30, roughness: 0.85 }),
    plastic:  std({ color: 0x23272d, metalness: 0.05, roughness: 0.48 }),
    paintBlue:std({ color: 0x1f5fae, metalness: 0.35, roughness: 0.35 }),
    paintRed: std({ color: 0xb8322a, metalness: 0.35, roughness: 0.38 }),
    pipe:     std({ color: 0xffffff, map: heatTint, emissive: 0x000000, emissiveMap: heatGlow, metalness: 0.88, roughness: 0.38 }),
    pipe2:    std({ color: 0x8d949b, metalness: 0.88, roughness: 0.40 }),
    belt:     std({ color: 0xffffff, map: beltTex, metalness: 0.0, roughness: 0.72 }),
    rubber:   std({ color: 0x1c1e22, metalness: 0.0, roughness: 0.80 })
  };
  M.belt.userData.isBelt = true;
  M.pipe.userData.isPipe = true;
}

/* housing materials get the cut plane + hatched "section" on back faces */
function makeHousing(m) {
  m.side = THREE.DoubleSide;
  m.clippingPlanes = [cutPlane];
  m.shadowSide = THREE.FrontSide;
  m.userData.housing = true;
  m.onBeforeCompile = sh => {
    sh.uniforms.uCapOn = CAP.uCapOn;
    sh.uniforms.uCapColor = CAP.uCapColor;
    sh.fragmentShader = 'uniform float uCapOn;\nuniform vec3 uCapColor;\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       if (!gl_FrontFacing) {
         if (uCapOn < 0.5) discard;
         float h = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.085));
         gl_FragColor = vec4(mix(uCapColor, uCapColor * 0.62, h), gl_FragColor.a);
       }`);
  };
  m.customProgramCacheKey = () => 'housing-cap';
}

export { M, createMaterials, makeHousing };
