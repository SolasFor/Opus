/* Материалы деталей M и корпусные материалы с плоскостью разреза и штриховкой сечения (makeHousing).
 * M-02b: раздел 5 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * M-07a: makeHousing() дополняет onBeforeCompile и ключ программы, заданные раньше, а не заменяет их.
 * Палитра под студийный свет: металлы — metalness до 1, шероховатость по виду обработки; userData.surf — вид
 * процедурной фактуры (render/surface.js, подключает nodeMat()); керамика и краска — MeshPhysicalMaterial с лаком.
 * Цвет побежалости выпуска (heatTint) спокойнее; свечение (heatGlow) и штриховка сечения прежние.
 * M-07b: обработанный алюминий (aluMach), чёрная краска (paintBlack), теплоэкран (shield). Крепёж и мелочь рисуются
 * одним мешем на узел: ключи tint() задают только цвет, Parts.add() пишет его в цвет вершин общего материала
 * hw (металл) или paintHw (краска), поэтому эти ключи сами в сцену не попадают.
 * M-07c: поковки (forged: щёки коленвала, маховик, шатуны), точёный поршень (piston); ключи-цвета hole (тёмные
 * заглушки — вид сверлений и облегчающих отверстий) и carbon (нагар на тарелках клапанов).
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
  const phys = o => new THREE.MeshPhysicalMaterial(o);
  const S = (m, surf) => { m.userData.surf = surf; return m; };   // M-07a: вид фактуры для render/surface.js
  const tint = (color, into = 'hw') => { const m = std({ color }); m.userData.into = into; return m; };   // M-07b
  // exhaust heat tint along the runner (u = 0 at the port): straw → bronze → blue → steel
  const heatTint = stripeTexture((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#8a6a48'); gr.addColorStop(0.16, '#94704e'); gr.addColorStop(0.30, '#6c5a6e');
    gr.addColorStop(0.44, '#5e6a80'); gr.addColorStop(0.62, '#868b92'); gr.addColorStop(1, '#a3a7ac');
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
    // корпусные отливки: чугун, алюминий (песчаная форма и литьё под давлением)
    iron:     S(std({ color: 0x5a5e63, metalness: 0.80, roughness: 0.66 }), 'iron'),
    alu:      S(std({ color: 0xa3a7ab, metalness: 0.88, roughness: 0.52 }), 'cast'),
    aluCast:  S(std({ color: 0x9a9ea2, metalness: 0.85, roughness: 0.60 }), 'cast'),
    aluLight: S(std({ color: 0xb9bdc1, metalness: 0.92, roughness: 0.34 }), 'castFine'),
    aluDark:  S(std({ color: 0x777c82, metalness: 0.85, roughness: 0.55 }), 'cast'),
    aluMach:  S(std({ color: 0xc4c8cc, metalness: 1.00, roughness: 0.26 }), 'machined'),   // M-07b: обработанные плоскости
    // сталь: шлифованные шейки и стержни, поковки
    steel:    S(std({ color: 0xb4b8bc, metalness: 1.00, roughness: 0.30 }), 'machined'),
    steelDark:S(std({ color: 0x6a6e72, metalness: 1.00, roughness: 0.46 }), 'forged'),
    forged:   S(std({ color: 0x7b7f83, metalness: 1.00, roughness: 0.50 }), 'forged'),     // M-07c: поковки
    piston:   S(std({ color: 0xc0c3c6, metalness: 0.92, roughness: 0.36 }), 'machined'),   // M-07c: точёный поршень
    chrome:   S(std({ color: 0xd2d6da, metalness: 1.00, roughness: 0.16 }), 'machined'),
    brass:    S(std({ color: 0xb98652, metalness: 1.00, roughness: 0.34 }), 'machined'),   // вкладыши
    rings:    S(std({ color: 0x2a2d31, metalness: 1.00, roughness: 0.36 }), 'machined'),
    ceramic:  phys({ color: 0xf2f1ec, metalness: 0.0, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }),   // глазурь изолятора
    gasket:   S(std({ color: 0x7d8186, metalness: 1.00, roughness: 0.40 }), 'castFine'),
    valve:    S(std({ color: 0x9c968c, metalness: 1.00, roughness: 0.34 }), 'machined'),
    cam:      S(std({ color: 0xb9bdc0, metalness: 1.00, roughness: 0.22 }), 'machined'),
    dark:     S(std({ color: 0x1c1e21, metalness: 0.60, roughness: 0.62 }), 'iron'),
    soot:     S(std({ color: 0x2b2826, metalness: 0.30, roughness: 0.88 }), 'iron'),
    plastic:  S(std({ color: 0x232528, metalness: 0.00, roughness: 0.58 }), 'plastic'),
    // краска с лаком (clearcoat): «апельсиновая корка» — в фактуре paint
    paintBlack:S(phys({ color: 0x18191b, metalness: 0.30, roughness: 0.50, clearcoat: 0.15, clearcoatRoughness: 0.45 }), 'paint'),   // M-07b: поддон, датчики
    paintHw:  S(phys({ color: 0xffffff, vertexColors: true, metalness: 0.20, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25 }), 'paint'),   // M-07b
    paintBlue:tint(0x174f97, 'paintHw'),   // M-07b: фильтр
    paintRed: tint(0xc8361f, 'paintHw'),   // M-07b: ручка щупа
    pipe:     S(std({ color: 0xffffff, map: heatTint, emissive: 0x000000, emissiveMap: heatGlow, metalness: 1.00, roughness: 0.36 }), 'castFine'),
    pipe2:    S(std({ color: 0x8e9196, metalness: 1.00, roughness: 0.42 }), 'castFine'),
    shield:   S(std({ color: 0xaeb2b6, metalness: 1.00, roughness: 0.40 }), 'shield'),   // M-07b: штампованный теплоэкран
    belt:     S(std({ color: 0xffffff, map: beltTex, metalness: 0.0, roughness: 0.78 }), 'rubber'),
    rubber:   S(std({ color: 0x151618, metalness: 0.0, roughness: 0.82 }), 'rubber'),
    // M-07b: крепёж и мелочь узла — общий материал с цветом вершин и ключи-цвета для него
    hw:       S(std({ color: 0xffffff, vertexColors: true, metalness: 1.00, roughness: 0.40 }), 'forged'),
    bolt:     tint(0x8a8d90),   // болты, гайки (оцинковка)
    boltDark: tint(0x2c2e31),   // оксидированные болты
    copper:   tint(0xb06a3e),   // медные гайки выпуска
    fitting:  tint(0xb4b8bc),   // мелкие стальные детали (цвет steel)
    fittingDark: tint(0x6a6e72),   // шайбы, пробки (цвет steelDark)
    shell:    tint(0xb98652),   // вкладыши коренных подшипников (цвет brass)
    wire:     tint(0x151618),   // провод датчика, резина демпфера (цвет rubber)
    hole:     tint(0x111214),   // M-07c: сверления и облегчающие отверстия — тёмные заглушки
    carbon:   tint(0x2b2826)    // M-07c: нагар на тарелках клапанов (цвет soot)
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
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;   // M-07a: вставки до makeHousing() сохраняются
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
