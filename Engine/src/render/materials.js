/* Материалы деталей V12 (M) и корпусные материалы с плоскостью разреза и штриховкой сечения (makeHousing).
 * Включает процедурные карты переплетения карбона 2×2, плато-хонинговки гильз 45°, побежалости титана/инконеля
 * и магниевой красной шагрени клапанных крышек.
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
function makeCarbonTexture() {
  const t = stripeTexture((g, w, h) => {
    g.fillStyle = '#111316'; g.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        const phase = ((x / s + y / s) | 0) % 4;
        const gr = g.createLinearGradient(x, y, x + s, y + s);
        if (phase < 2) { gr.addColorStop(0, '#1c1f24'); gr.addColorStop(0.5, '#343942'); gr.addColorStop(1, '#15181c'); }
        else { gr.addColorStop(0, '#101215'); gr.addColorStop(0.5, '#242830'); gr.addColorStop(1, '#121418'); }
        g.fillStyle = gr; g.fillRect(x, y, s - 1, s - 1);
      }
    }
  }, 128, 128);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.anisotropy = 4;
  return t;
}
function makeHoneTexture() {
  const t = stripeTexture((g, w, h) => {
    g.fillStyle = '#adb2b9'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(42,46,52,0.34)'; g.lineWidth = 1;
    for (let i = -w; i < w * 2; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
    }
  }, 128, 128);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 8);
  t.anisotropy = 4;
  return t;
}
function createMaterials() {
  const std = o => new THREE.MeshStandardMaterial(o);
  const phys = o => new THREE.MeshPhysicalMaterial(o);
  const S = (m, surf) => { m.userData.surf = surf; return m; };
  const tint = (color, into = 'hw') => { const m = std({ color }); m.userData.into = into; return m; };
  const carbonTex = makeCarbonTexture();
  const honeTex = makeHoneTexture();

  // Побежалость титана/инконеля вдоль первичных труб: солома → бронза → фиолетовый → синий → титан
  const heatTint = stripeTexture((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#9a7446'); gr.addColorStop(0.14, '#8d5b68'); gr.addColorStop(0.28, '#5a628e');
    gr.addColorStop(0.42, '#4c7498'); gr.addColorStop(0.62, '#8b8f96'); gr.addColorStop(1, '#a9adb2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const heatGlow = stripeTexture((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#a6a6a6'); gr.addColorStop(1, '#262626');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const beltTex = stripeTexture((g, w, h) => {
    g.fillStyle = '#17191c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2e33'; g.fillRect(0, 0, w * 0.5, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(w * 0.5, 0, w * 0.06, h);
  }, 64, 8);
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  const polyTex = stripeTexture((g, w, h) => {
    g.fillStyle = '#141517'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4e54'; [[0.06, 0.12], [0.22, 0.05], [0.31, 0.16]].forEach(([x, l]) => g.fillRect(w * x, h * 0.375, w * l, h * 0.25));
  }, 64, 16);
  polyTex.wrapS = THREE.RepeatWrapping;

  M = {
    iron:     S(std({ color: 0x5a5e63, metalness: 0.80, roughness: 0.66 }), 'iron'),
    alu:      S(std({ color: 0xa3a7ab, metalness: 0.88, roughness: 0.50 }), 'cast'),
    aluCast:  S(std({ color: 0x9a9ea2, metalness: 0.85, roughness: 0.58 }), 'cast'),
    aluLight: S(std({ color: 0xb9bdc1, metalness: 0.92, roughness: 0.34 }), 'castFine'),
    aluDark:  S(std({ color: 0x777c82, metalness: 0.85, roughness: 0.54 }), 'cast'),
    aluMach:  S(std({ color: 0xc8ccd0, metalness: 1.00, roughness: 0.22 }), 'machined'),
    liner:    S(std({ color: 0xb8bcc2, map: honeTex, metalness: 0.96, roughness: 0.22 }), 'honed'),
    steel:    S(std({ color: 0xb6bac0, metalness: 1.00, roughness: 0.28 }), 'machined'),
    steelDark:S(std({ color: 0x6a6e72, metalness: 1.00, roughness: 0.44 }), 'forged'),
    forged:   S(std({ color: 0x7b7f83, metalness: 1.00, roughness: 0.48 }), 'forged'),
    piston:   S(std({ color: 0xc2c5c9, metalness: 0.94, roughness: 0.32 }), 'machined'),
    chrome:   S(std({ color: 0xd6dade, metalness: 1.00, roughness: 0.14 }), 'machined'),
    gold:     S(std({ color: 0xd4a44a, metalness: 0.96, roughness: 0.24 }), 'machined'),
    brass:    S(std({ color: 0xb98652, metalness: 1.00, roughness: 0.32 }), 'machined'),
    rings:    S(std({ color: 0x2a2d31, metalness: 1.00, roughness: 0.34 }), 'machined'),
    ceramic:  phys({ color: 0xf2f1ec, metalness: 0.0, roughness: 0.22, clearcoat: 0.65, clearcoatRoughness: 0.14 }),
    gasket:   S(std({ color: 0x7d8186, metalness: 1.00, roughness: 0.38 }), 'castFine'),
    valve:    S(std({ color: 0xa09a90, metalness: 1.00, roughness: 0.32 }), 'machined'),
    cam:      S(std({ color: 0xc0c4c8, metalness: 1.00, roughness: 0.20 }), 'machined'),
    dark:     S(std({ color: 0x1c1e21, metalness: 0.60, roughness: 0.62 }), 'iron'),
    soot:     S(std({ color: 0x2b2826, metalness: 0.30, roughness: 0.88 }), 'iron'),
    plastic:  S(std({ color: 0x232528, metalness: 0.00, roughness: 0.56 }), 'plastic'),
    carbonWeave: S(phys({ color: 0xffffff, map: carbonTex, metalness: 0.15, roughness: 0.24, clearcoat: 1.0, clearcoatRoughness: 0.08 }), 'carbon'),
    crinkleRed: S(phys({ color: 0xa81c1c, metalness: 0.12, roughness: 0.68, clearcoat: 0.22, clearcoatRoughness: 0.52 }), 'wrinkle'),
    paintBlack: S(phys({ color: 0x18191b, metalness: 0.30, roughness: 0.48, clearcoat: 0.18, clearcoatRoughness: 0.42 }), 'paint'),
    paintHw:  S(phys({ color: 0xffffff, vertexColors: true, metalness: 0.20, roughness: 0.40, clearcoat: 0.72, clearcoatRoughness: 0.24 }), 'paint'),
    paintBlue:tint(0x174f97, 'paintHw'),
    paintRed: tint(0xc8361f, 'paintHw'),
    pipe:     S(std({ color: 0xffffff, map: heatTint, emissive: 0x000000, emissiveMap: heatGlow, metalness: 1.00, roughness: 0.30 }), 'titanium'),
    pipe2:    S(std({ color: 0x92969c, metalness: 1.00, roughness: 0.34 }), 'titanium'),
    shield:   S(std({ color: 0xb2b6ba, metalness: 1.00, roughness: 0.38 }), 'shield'),
    belt:     S(std({ color: 0xffffff, map: beltTex, metalness: 0.0, roughness: 0.78 }), 'rubber'),
    polyBelt: S(std({ color: 0xffffff, map: polyTex, metalness: 0.0, roughness: 0.74 }), 'rubber'),
    rubber:   S(std({ color: 0x151618, metalness: 0.0, roughness: 0.82 }), 'rubber'),
    hw:       S(std({ color: 0xffffff, vertexColors: true, metalness: 1.00, roughness: 0.38 }), 'forged'),
    bolt:     tint(0x8a8d90),
    boltDark: tint(0x2c2e31),
    copper:   tint(0xb06a3e),
    anodizedBlue: tint(0x1d6fe8),
    anodizedRed: tint(0xc92a2a),
    fitting:  tint(0xb4b8bc),
    fittingDark: tint(0x6a6e72),
    shell:    tint(0xb98652),
    wire:     tint(0x151618),
    hole:     tint(0x111214),
    carbon:   tint(0x2b2826)
  };
  M.belt.userData.isBelt = true;
  M.pipe.userData.isPipe = true;
  M.pipe2.userData.isPipe = true;
}

function makeHousing(m) {
  m.side = THREE.DoubleSide;
  m.clippingPlanes = [cutPlane];
  m.shadowSide = THREE.FrontSide;
  m.userData.housing = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
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
  m.customProgramCacheKey = () => 'housing-cap|' + prevKey.call(m);
}

export { M, createMaterials, makeHousing };
