/* Процедурная фактура поверхностей (M-07a): литьё, ковка, механическая обработка, краска, пластик, резина;
 * M-07b: тиснёный теплоэкран.
 * Вставка в шейдер MeshStandardMaterial и MeshPhysicalMaterial: шум в координатах детали (1 ед. = 100 мм) даёт
 * микрорельеф (bump через производные экрана), пятна цвета и разброс шероховатости. Текстуры и UV не нужны.
 * Рельеф гаснет, когда зерно становится мельче пикселя, поэтому издали поверхность не мерцает.
 * Модуль ничего не импортирует: applySurface() подключает вставку к материалу через onBeforeCompile.
 * Без WebGL2 вставка не применяется (нужны производные dFdx/dFdy), материал остаётся обычным.
 */

const KINDS = {
  //            зерно (1/ед.)  рельеф (ед.)  пятна (1/ед.)  разброс цвета  разброс шероховатости
  cast:     { g: 70,  b: 0.00042, s: 2.6, c: 0.07,  r: 0.10 },   // литой алюминий (песчаная форма)
  castFine: { g: 120, b: 0.00012, s: 3.5, c: 0.05,  r: 0.08 },   // литьё под давлением, трубы
  iron:     { g: 55,  b: 0.00055, s: 2.2, c: 0.10,  r: 0.10 },   // чугун, окалина
  forged:   { g: 40,  b: 0.00030, s: 3.0, c: 0.08,  r: 0.08 },   // поковки
  machined: { g: 260, b: 0.00006, s: 6.0, c: 0.025, r: 0.05 },   // шлифованные шейки, стержни
  paint:    { g: 30,  b: 0.00010, s: 4.0, c: 0.03,  r: 0.05 },   // «апельсиновая корка» краски
  plastic:  { g: 160, b: 0.00012, s: 3.0, c: 0.04,  r: 0.08 },   // стеклонаполненный полиамид
  rubber:   { g: 140, b: 0.00010, s: 5.0, c: 0.05,  r: 0.06 },
  shield:   { g: 22,  b: 0.00060, s: 3.0, c: 0.06,  r: 0.10 }    // M-07b: тиснёный теплоэкран
};
const CHUNKS = ['#include <begin_vertex>', '#include <color_fragment>', '#include <roughnessmap_fragment>', '#include <normal_fragment_maps>'];
const num = v => v.toFixed(6);
const NOISE = `
varying vec3 vSurfP;
float sHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sNoise(vec3 x) {
  vec3 i = floor(x), q = fract(x); q = q * q * (3.0 - 2.0 * q);
  return mix(mix(mix(sHash(i), sHash(i + vec3(1, 0, 0)), q.x), mix(sHash(i + vec3(0, 1, 0)), sHash(i + vec3(1, 1, 0)), q.x), q.y),
             mix(mix(sHash(i + vec3(0, 0, 1)), sHash(i + vec3(1, 0, 1)), q.x), mix(sHash(i + vec3(0, 1, 1)), sHash(i + vec3(1, 1, 1)), q.x), q.y), q.z);
}
vec3 surfPerturb(vec3 surfPos, vec3 n, vec2 dH, float fd) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`;
/* вставка в шейдер; если three.js сменит имена фрагментов, ошибка видна сразу, а не как «тихо пропавшая» фактура */
const known = kind => typeof kind === 'string' && Object.prototype.hasOwnProperty.call(KINDS, kind);
function patchShader(sh, kind) {
  if (!known(kind)) throw new Error('surface: неизвестный вид фактуры ' + kind);
  const k = KINDS[kind];
  for (const c of CHUNKS) if (!(c === CHUNKS[0] ? sh.vertexShader : sh.fragmentShader).includes(c)) throw new Error('surface: нет фрагмента шейдера ' + c);
  sh.vertexShader = 'varying vec3 vSurfP;\n' + sh.vertexShader.replace(CHUNKS[0], CHUNKS[0] + '\n  vSurfP = position;');
  const head = `#define SURF_G ${num(k.g)}\n#define SURF_B ${num(k.b)}\n#define SURF_S ${num(k.s)}\n#define SURF_C ${num(k.c)}\n#define SURF_R ${num(k.r)}\n`;
  sh.fragmentShader = head + NOISE + sh.fragmentShader
    .replace(CHUNKS[1], `${CHUNKS[1]}
      float sBl = sNoise(vSurfP * SURF_S) * 0.6 + sNoise(vSurfP * SURF_S * 2.7 + 3.3) * 0.4;
      diffuseColor.rgb *= 1.0 + (sBl - 0.5) * 2.0 * SURF_C;`)
    .replace(CHUNKS[2], `${CHUNKS[2]}
      roughnessFactor = clamp(roughnessFactor + (sBl - 0.5) * 2.0 * SURF_R, 0.04, 1.0);`)
    .replace(CHUNKS[3], `${CHUNKS[3]}
      {
        vec3 sq = vSurfP * SURF_G;
        float sFade = 1.0 - smoothstep(0.45, 1.3, length(fwidth(sq)));
        float sH = (sNoise(sq) + 0.5 * sNoise(sq * 2.07 + 7.1)) * SURF_B * sFade;
        normal = surfPerturb(-vViewPosition, normal, vec2(dFdx(sH), dFdy(sH)), faceDirection);
      }`);
  return sh;
}
/* m.userData.surf — имя из KINDS; вызывается для каждого клона материала узла до makeHousing() */
function applySurface(m) {
  const kind = m.userData.surf;
  if (!known(kind)) return false;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    if (!r || r.capabilities.isWebGL2) patchShader(sh, kind);
    prev.call(m, sh, r);
  };
  m.customProgramCacheKey = () => 'surf-' + kind + '|' + prevKey.call(m);
  return true;
}

export { KINDS, CHUNKS, patchShader, applySurface };
