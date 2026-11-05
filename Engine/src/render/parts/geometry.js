/* Процедурная геометрия: примитивы G, extrudeX и extrudeY, профиль шестерни, сборщик merged-мешей Parts;
 * nodeMat — материал узла, registerLocalPart — часть узла со своим смещением при разборке.
 * M-02b: из раздела 6 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * Здесь начало раздела 6 и две последние функции блока «nodes».
 * M-07a: nodeMat() подключает к материалу узла процедурную фактуру (applySurface из render/surface.js);
 * extrudeX и extrudeY сглаживают нормали (smooth).
 * M-07b: скруглённые коробки и тела вращения (G.rbox, G.lathe, G.latheX, G.latheZ, G.hex), контуры (roundRect,
 * holePath, poly), выдавливание с фаской внутрь, без роста внешних размеров (extrudeXb, extrudeZ, extrudeY с bevel),
 * болт с шайбой (Parts.bolt). Parts.add() переводит ключи-цвета (M.bolt и др., materials.js) в цвет вершин общего
 * материала узла, поэтому крепёж и мелочь узла — один меш.
 * M-07c: уровень детализации «низкий» (detail.low, задаёт setDetail() до сборки узлов): у дуг и тел вращения вдвое
 * меньше сегментов (lodSeg), крепёж и мелочь (ключи-цвета общего материала hw) не добавляются. G.lathe — с сектором
 * (p0, pl), G.tube — труба по кривой.
 */
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V3 } from '../world.js';
import { M, makeHousing } from '../materials.js';
import { applySurface } from '../surface.js';

/* M-07c: уровень детализации. «Низкий» — вдвое меньше сегментов, но не меньше 8; 8 и меньше (шестигранники,
 * сечения тонких торов) не меняются */
const detail = { low: false };
const setDetail = low => { detail.low = !!low; };
const lodSeg = n => (detail.low && n > 8 ? Math.max(8, Math.round(n / 2)) : n);
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, lodSeg(s), 1, open),
  cylX: (r, len, s = 22) => new THREE.CylinderGeometry(r, r, len, lodSeg(s)).rotateZ(Math.PI / 2),
  cylZ: (r, len, s = 22) => new THREE.CylinderGeometry(r, r, len, lodSeg(s)).rotateX(Math.PI / 2),
  torusX: (R, t, rs = 10, ts = 28) => new THREE.TorusGeometry(R, t, lodSeg(rs), lodSeg(ts)).rotateY(Math.PI / 2),
  torusY: (R, t, rs = 8, ts = 24) => new THREE.TorusGeometry(R, t, lodSeg(rs), lodSeg(ts)).rotateX(Math.PI / 2),
  // M-07b: скруглённые кромки (радиус не больше половины стороны), тела вращения по профилю, шестигранник
  rbox: (w, h, d, r = 0.02, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)),
  lathe: (pts, seg = 32, p0 = 0, pl = Math.PI * 2) => new THREE.LatheGeometry(profile(pts), lodSeg(seg), p0, pl),
  latheX: (pts, seg = 32, p0, pl) => G.lathe(pts, seg, p0, pl).rotateZ(-Math.PI / 2),
  latheZ: (pts, seg = 32, p0, pl) => G.lathe(pts, seg, p0, pl).rotateX(Math.PI / 2),
  hex: (r, h) => new THREE.CylinderGeometry(r, r, h, 6),
  tube: (curve, n, r, rs = 8) => new THREE.TubeGeometry(curve, lodSeg(n), r, lodSeg(rs), false)   // M-07c
};
/* M-07b: профиль тела вращения — точки [r, y] снизу вверх по наружной поверхности. Угол острый (точка повторяется,
 * нормали не усредняются); третий элемент 1 — гладкая точка. */
function profile(pts) {
  const out = [];
  pts.forEach(p => { const v = new THREE.Vector2(Math.max(0, p[0]), p[1]); out.push(v); if (!p[2]) out.push(v.clone()); });
  return out;
}
function roundRect(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function holePath(x, y, r) { const h = new THREE.Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); return h; }
function poly(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
/* M-07a: у ExtrudeGeometry нормали по граням — дуги и фаски выглядят гранёными. Нормали усредняются между гранями,
 * которые сходятся под углом меньше CREASE; более острые кромки (торцы, зубья) остаются резкими. */
const CREASE = 38 * Math.PI / 180;
function smooth(g) { const r = toCreasedNormals(g, CREASE); if (r !== g) g.dispose(); return r; }
/* shape in (u,v) extruded along world X; (u,v) → world (·, v, −u) */
function extrudeX(shape, depth, seg = 24, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, curveSegments: lodSeg(seg), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return smooth(g);
}
/* shape in (x,v) extruded along world +Y from 0..depth; (x,v) → world (x, ·, −v).
 * M-07b: bevel > 0 — фаска внутрь контура: внешний размер и высота те же, что без фаски */
function extrudeY(shape, depth, seg = 32, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, curveSegments: lodSeg(seg), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 2 });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2);
  return smooth(g);
}
/* M-07b: shape in (x,y) extruded along world Z, centred; фаска внутрь, как у extrudeY */
function extrudeZ(shape, depth, seg = 24, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, curveSegments: lodSeg(seg), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 2 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return smooth(g);
}
/* M-07b: extrudeX с фаской внутрь: внешний размер равен контуру и толщине */
function extrudeXb(shape, depth, seg = 24, bevel = 0.01) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, curveSegments: lodSeg(seg), bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 2 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  g.rotateY(Math.PI / 2);
  return smooth(g);
}
/* M-07b: шестигранная головка болта с шайбой и фаской, ось +Y от y = 0 (ROT поворачивает по направлению) */
function boltGeo(r, h) {
  const parts = [G.hex(r, h).translate(0, h / 2 + 0.008, 0), G.cyl(r * 1.3, r * 1.3, 0.008, 16).translate(0, 0.004, 0),
    G.cyl(r * 0.25, r * 0.4, 0.006, 8).translate(0, h + 0.011, 0)];
  return mergeGeometries(parts.map(g => { const n = g.toNonIndexed(); g.dispose(); n.deleteAttribute('uv'); return n; }), false);
}
const ROT = { y: null, '-y': [Math.PI, 0, 0], z: [Math.PI / 2, 0, 0], '-z': [-Math.PI / 2, 0, 0], x: [0, 0, -Math.PI / 2], '-x': [0, 0, Math.PI / 2] };
function gearShape(teeth, rRoot, rTip) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = i / teeth * Math.PI * 2, da = Math.PI * 2 / teeth;
    const pts = [[rRoot, a0], [rTip, a0 + da * 0.18], [rTip, a0 + da * 0.48], [rRoot, a0 + da * 0.66]];
    pts.forEach(([r, a], k) => {
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  return s;
}

class Parts {
  constructor() { this.byMat = new Map(); this.noShadow = new Set(); }
  add(geo, mat, pos, rot, scl) {
    if (detail.low && mat.userData.into === 'hw') { geo.dispose(); return this; }   // M-07c: «низкий» — без мелочи
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    const into = mat.userData.into;          // M-07b: ключ-цвет → цвет вершин общего материала узла (hw, paintHw)
    if (into) {
      const c = mat.color, n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      mat = M[into];
    }
    if (pos || rot || scl) {
      const m = new THREE.Matrix4().compose(
        pos ? V3(pos[0], pos[1], pos[2]) : V3(0, 0, 0),
        new THREE.Quaternion().setFromEuler(rot ? new THREE.Euler(rot[0], rot[1], rot[2]) : new THREE.Euler()),
        scl ? V3(scl[0], scl[1], scl[2]) : V3(1, 1, 1));
      g.applyMatrix4(m);
    }
    if (!this.byMat.has(mat)) this.byMat.set(mat, []);
    this.byMat.get(mat).push(g);
    return this;
  }
  bolt(mat, pos, dir = 'y', r = 0.04, h = 0.035) {   // M-07b; M-07c: «низкий» — без болтов
    return detail.low && mat.userData.into === 'hw' ? this : this.add(boltGeo(r, h), mat, pos, ROT[dir]);
  }
  geometries() {
    const out = [];
    for (const [mat, list] of this.byMat) { out.push([mat, mergeGeometries(list, false)]); list.forEach(g => g.dispose()); }
    return out;
  }
  /* one Mesh per material, materials resolved per node (for per-node glow/ghosting) */
  build(parent, node, castShadow = true) {
    for (const [mat, geo] of this.geometries()) {
      const mesh = new THREE.Mesh(geo, nodeMat(node, mat));
      mesh.castShadow = castShadow && !this.noShadow.has(mat);
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
  instanced(parent, node, count) {
    const meshes = [];
    for (const [mat, geo] of this.geometries()) {
      const mesh = new THREE.InstancedMesh(geo, nodeMat(node, mat), count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }
}

function nodeMat(node, base) {
  const ud = node.userData;
  if (!ud.mats.has(base)) {
    const m = base.clone();
    m.userData = { ...base.userData, baseOpacity: base.opacity, baseEmissive: base.emissive.clone() };
    applySurface(m);                        // M-07a: фактура по m.userData.surf, до makeHousing()
    if (ud.housing) makeHousing(m);
    ud.mats.set(base, m);
  }
  return ud.mats.get(base);
}
function registerLocalPart(node, object, orig, expl) {
  node.userData.localParts.push({ object, orig: V3(...orig), expl: V3(...expl) });
  object.position.set(...orig);
}

export { G, extrudeX, extrudeXb, extrudeY, extrudeZ, gearShape, Parts, nodeMat, registerLocalPart, roundRect, holePath, poly, detail, setDetail };
