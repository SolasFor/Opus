/* Процедурная геометрия: примитивы G, extrudeX и extrudeY, профиль шестерни, сборщик merged-мешей Parts;
 * nodeMat — материал узла, registerLocalPart — часть узла со своим смещением при разборке.
 * M-02b: из раздела 6 Engine/src/main.js, дословно. Совпадение со строками main.js@ac34ff3
 * проверяет tests/split-sync.test.js.
 * Здесь начало раздела 6 и две последние функции блока «nodes».
 * M-07a: nodeMat() подключает к материалу узла процедурную фактуру (applySurface из render/surface.js);
 * extrudeX и extrudeY сглаживают нормали (smooth).
 */
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { V3 } from '../world.js';
import { makeHousing } from '../materials.js';
import { applySurface } from '../surface.js';

const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open),
  cylX: (r, len, s = 22) => new THREE.CylinderGeometry(r, r, len, s).rotateZ(Math.PI / 2),
  cylZ: (r, len, s = 22) => new THREE.CylinderGeometry(r, r, len, s).rotateX(Math.PI / 2),
  torusX: (R, t, rs = 10, ts = 28) => new THREE.TorusGeometry(R, t, rs, ts).rotateY(Math.PI / 2),
  torusY: (R, t, rs = 8, ts = 24) => new THREE.TorusGeometry(R, t, rs, ts).rotateX(Math.PI / 2)
};
/* M-07a: у ExtrudeGeometry нормали по граням — дуги и фаски выглядят гранёными. Нормали усредняются между гранями,
 * которые сходятся под углом меньше CREASE; более острые кромки (торцы, зубья) остаются резкими. */
const CREASE = 38 * Math.PI / 180;
function smooth(g) { const r = toCreasedNormals(g, CREASE); if (r !== g) g.dispose(); return r; }
/* shape in (u,v) extruded along world X; (u,v) → world (·, v, −u) */
function extrudeX(shape, depth, seg = 24, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, curveSegments: seg, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return smooth(g);
}
/* shape in (x,v) extruded along world +Y from 0..depth; (x,v) → world (x, ·, −v) */
function extrudeY(shape, depth, seg = 32) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, curveSegments: seg, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return smooth(g);
}
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
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
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

export { G, extrudeX, extrudeY, gearShape, Parts, nodeMat, registerLocalPart };
