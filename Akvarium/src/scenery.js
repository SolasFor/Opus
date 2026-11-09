/**
 * Akvarium — декорации (A-01b): стекло, фон и тумба, песок, камни, кораллы и морские звёзды, водоросли,
 * актинии, горгонария, поверхность воды с рябью, лучи света, морской снег и планктон.
 * Тело — строки 325–914 модуля однофайловой Aquarium.html (D-13), перенесены дословно; швы — tests/split.test.js.
 * Шов: seed = N → reseed(N) (общий поток ГПСЧ с основой и рыбами).
 * A-03, шаг 2: лучи света связаны с мутностью — ярче там, где есть чему рассеивать свет, и гаснут с глубиной в мутной воде;
 * при мутности по умолчанию — как раньше.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { D, fbm, HS, HT, patch, reseed, rnd, rr, scene, smooth, SUN, U, vnoise, W, WATER_GLSL } from './core.js';

// ------------------------------------------------------------------ tank shell: backdrop walls, stand, frame, glass
const lampMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff });
const glassMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uRT: U.uRT, uKnock: U.uKnock },
  vertexShader: `varying vec3 vN; varying vec3 vP; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vP=w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uRT; uniform vec4 uKnock; varying vec3 vN; varying vec3 vP; varying vec2 vUv;
    void main(){
      vec3 v = normalize(cameraPosition - vP);
      float f = pow(1.0 - abs(dot(v, vN)), 4.0);
      float streak = smoothstep(0.0, 0.08, abs(fract((vUv.x + vUv.y * 0.6) * 1.3) - 0.5) - 0.38) ;
      float edge = smoothstep(0.985, 1.0, max(abs(vUv.x*2.-1.), abs(vUv.y*2.-1.)));
      vec3 c = vec3(0.55, 0.8, 0.9) * (0.02 + 0.25 * f + 0.025 * streak) + vec3(0.25, 0.45, 0.45) * edge;
      float age = uRT - uKnock.w;
      if (age < 2.5) {               // knock: expanding rings on the glass
        float d = distance(vP, uKnock.xyz);
        float r1 = abs(d - age * 4.0), r2 = abs(d - age * 2.6);
        float ring = smoothstep(0.12, 0.0, r1) + 0.6 * smoothstep(0.08, 0.0, r2) + smoothstep(0.35, 0.0, d) * 1.5;
        c += vec3(0.6, 0.9, 1.0) * ring * exp(-age * 2.2) * 0.55;
      }
      gl_FragColor = vec4(c, 1.0);
    }`
});
let backdrop;
{
  const bd = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: WATER_GLSL + `varying vec3 vP;
      void main(){
        vec3 c = waterColor(vP.y);
        float lat = abs(vP.x) / uBoxMax.x;
        c *= 0.82 + 0.25 * (1.0 - lat * lat);
        float sh = causticT(vec2(vP.x + vP.z, vP.y * 1.6) * 0.22, uTime * 0.4);
        c += vec3(0.006, 0.014, 0.016) * sh * smoothstep(4.0, 8.0, vP.y) * uCaus;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  // all four side walls use the backdrop; back-face culling keeps the near wall out of the way from any side,
  // and from inside the tank (fish camera) the walls read as endless water
  backdrop = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, HS + 0.5, D - 0.02), [bd, bd, hide, hide, bd, bd]);
  backdrop.position.set(0, (HS + 0.5) / 2 - 0.5, 0);
  scene.add(backdrop);

  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0f12, roughness: 0.45, metalness: 0.3 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.7, metalness: 0.0 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 30, D + 1.2), wood);
  stand.position.set(0, -15 - 0.35, 0); scene.add(stand);
  const rimB = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.5, D + 0.5), dark);
  rimB.position.set(0, -0.15, 0); scene.add(rimB);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.6, D + 0.5), dark);
  hood.position.set(0, HT + 0.3, 0); scene.add(hood);
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.5, 0.5), lampMat);
  lamp.rotation.x = Math.PI / 2; lamp.position.set(0, HT - 0.005, 0.6); scene.add(lamp);
  const lamp2 = lamp.clone(); lamp2.position.z = -1.4; scene.add(lamp2);

  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, HT + 0.4), glassMat);
  front.position.set(0, (HT + 0.4) / 2 - 0.4, D / 2 + 0.03); front.renderOrder = 10; scene.add(front);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, HT + 0.4), glassMat);
    side.rotation.y = Math.PI / 2; side.position.set(s * (W / 2 + 0.03), (HT + 0.4) / 2 - 0.4, 0); side.renderOrder = 10; scene.add(side);
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x5f8f8c, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, HT + 0.4, 0.08), edgeMat);
    e.position.set(sx * (W / 2 + 0.03), (HT + 0.4) / 2 - 0.4, sz * (D / 2 + 0.03)); scene.add(e);
  }
}
// ------------------------------------------------------------------ sand
const MOUNDS = [[-3.5, -1.8, 2.6, 0.55], [4.0, -2.0, 2.0, 0.4], [1.2, 1.6, 1.0, 0.18]];
function sandH(x, z) {
  let h = 0.35 + 0.55 * smooth(3.5, -4, z);
  h += 0.28 * fbm(x * 0.18, 0.0, z * 0.22, 3);
  const n = fbm(x * 0.5 + 10, 1, z * 0.5, 2);
  h += 0.035 * Math.sin(x * 2.6 + z * 0.8 + n * 5.0) * (0.6 + 0.4 * n);
  for (const [mx, mz, r, a] of MOUNDS) { const d2 = ((x - mx) ** 2 + (z - mz) ** 2) / (r * r); h += a * Math.exp(-d2 * 1.5); }
  return h;
}
{
  const g = new THREE.PlaneGeometry(W - 0.02, D - 0.02, 192, 96);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = sandH(x, z);
    p.setY(i, y);
    const n = fbm(x * 0.9, 3, z * 0.9, 3), m = fbm(x * 3.1, 7, z * 3.1, 2);
    const c = new THREE.Color().setRGB(0.72, 0.62, 0.46).lerp(new THREE.Color(0.86, 0.78, 0.62), 0.5 + 0.5 * n);
    c.multiplyScalar(0.78 + 0.14 * m);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  // grain texture
  const S = 256, data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const r = Math.random(); let v = 200 + r * 55; if (r < 0.04) v = 120 + Math.random() * 60; if (r > 0.985) v = 255;
    const tint = Math.random() < 0.05 ? 0.85 : 1.0;
    data[i * 4] = v; data[i * 4 + 1] = v * (tint < 1 ? 0.95 : 0.97); data[i * 4 + 2] = v * tint * 0.92; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 7);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  const m = patch(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 1.0, metalness: 0 }), { key: 'sand', caustic: 2.2 });
  scene.add(new THREE.Mesh(g, m));
}

{
  const N = 200, g = new THREE.PlaneGeometry(W - 0.02, 1, N, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), top = p.getY(i) > 0; p.setY(i, top ? sandH(x, D / 2 - 0.01) : -0.4); }
  const m = new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uNight; uniform float uWarm; varying vec3 vP;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 q = vP.xy * vec2(60.0, 60.0); float g = h2(floor(q));
        float layer = 0.5 + 0.5 * sin(vP.y * 18.0 + sin(vP.x * 1.3) * 1.5);
        vec3 c = mix(vec3(0.50, 0.42, 0.30), vec3(0.78, 0.70, 0.55), 0.55 * layer + 0.45 * g);
        if (g > 0.97) c *= 0.5;
        float peb = h2(floor(vP.xy * vec2(9.0, 9.0)));
        if (peb > 0.93) c = mix(c, vec3(0.45, 0.43, 0.42), 0.6);
        c *= 0.55 + 0.45 * smoothstep(-0.4, 0.6, vP.y);
        gl_FragColor = vec4(c * mix(vec3(0.3, 0.37, 0.42), vec3(0.42, 0.33, 0.3), uWarm * 0.6) * (1.0 - 0.78 * uNight), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const s = new THREE.Mesh(g, m); s.position.z = D / 2 - 0.01; scene.add(s);
}
// ------------------------------------------------------------------ static scenery (rocks, corals, starfish) -> one merged mesh
const statics = [];
function finish(g, colorFn, glow = 0) {
  g.deleteAttribute('uv');
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count);
  const tmp = new THREE.Color(), P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    P.fromBufferAttribute(p, i); N.fromBufferAttribute(n, i);
    const r = colorFn(P, N, tmp, i); c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
    gl[i] = typeof r === 'number' ? r : glow;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
  statics.push(g);
}
function rock(cx, cy, cz, sx, sy, sz, sd, detail = 5) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.3 + sd, v.y * 1.3, v.z * 1.3, 5);
    const r = 1 + 0.38 * n + 0.08 * Math.abs(vnoise(v.x * 5 + sd, v.y * 5, v.z * 5));
    v.multiplyScalar(r); v.x *= sx; v.y *= sy; v.z *= sz;
    if (v.y < -sy * 0.55) v.y = -sy * 0.55 + (v.y + sy * 0.55) * 0.2;
    p.setXYZ(i, v.x + cx, v.y + cy, v.z + cz);
  }
  g.computeVertexNormals();
  finish(g, (P, N, c) => {
    const a = fbm(P.x * 0.9 + sd, P.y * 0.9, P.z * 0.9, 3), b = vnoise(P.x * 4, P.y * 4, P.z * 4);
    c.setRGB(0.42, 0.37, 0.33).multiplyScalar(0.75 + 0.35 * b);
    if (a > 0.05) c.lerp(new THREE.Color(0.62, 0.30, 0.50), smooth(0.05, 0.3, a) * 0.85);       // coralline algae
    if (a < -0.2) c.lerp(new THREE.Color(0.75, 0.62, 0.55), 0.5);
    if (N.y > 0.55) c.lerp(new THREE.Color(0.25, 0.42, 0.18), smooth(0.55, 0.95, N.y) * (0.5 + 0.5 * b) * 0.7); // algae on top
  });
}
// rock piles
rock(-3.6, 0.9, -1.9, 2.1, 1.2, 1.5, 1.1);
rock(-2.4, 2.1, -2.3, 1.3, 1.0, 1.1, 2.3);
rock(-4.6, 2.0, -2.2, 1.0, 1.3, 1.0, 3.7);
rock(-3.4, 3.0, -2.6, 0.8, 0.7, 0.8, 4.1);
rock(-5.6, 0.7, -1.2, 0.8, 0.6, 0.7, 5.5);
rock(4.0, 0.8, -2.1, 1.8, 1.0, 1.3, 6.2);
rock(4.9, 1.7, -2.5, 1.0, 0.9, 0.9, 7.7);
rock(3.2, 1.6, -2.6, 0.8, 0.8, 0.7, 8.4);
rock(1.3, 0.45, 1.6, 0.6, 0.35, 0.5, 9.9, 4);
rock(-5.4, 0.55, 3.0, 0.45, 0.3, 0.4, 10.3, 4);
rock(6.4, 0.6, 1.4, 0.5, 0.35, 0.45, 11.7, 4);

// branching coral (recursive cylinders)
function branchCoral(x, y, z, scale, baseC, tipC, sd, depthMax = 4, glow = 0.35) {
  reseed(sd);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  function br(start, dir, len, rad, d) {
    const end = start.clone().addScaledVector(dir, len);
    const cg = new THREE.CylinderGeometry(rad * 0.72, rad, len, 7, 2, false);
    cg.translate(0, len / 2, 0);
    cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    cg.translate(start.x, start.y, start.z);
    const t0 = d / depthMax;
    finishLocal(cg, t0, (d + 1) / depthMax);
    parts.push(cg);
    if (d >= depthMax - 1) {
      const sg = new THREE.SphereGeometry(rad * 0.75, 8, 6); sg.translate(end.x, end.y, end.z);
      finishLocal(sg, 1, 1); parts.push(sg); return;
    }
    const kids = 2 + (rnd() < 0.45 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const nd = dir.clone().add(new THREE.Vector3(rr(-0.75, 0.75), rr(0.1, 0.55), rr(-0.75, 0.75))).normalize();
      if (nd.y < 0.25) { nd.y = 0.25; nd.normalize(); }
      br(end, nd, len * rr(0.68, 0.88), rad * 0.72, d + 1);
    }
  }
  function finishLocal(g, t0, t1) {
    g.userData.t = [t0, t1];
  }
  br(new THREE.Vector3(0, 0, 0), new THREE.Vector3(rr(-0.2, 0.2), 1, rr(-0.2, 0.2)).normalize(), 0.55, 0.11, 0);
  for (const g of parts) {
    const [t0, t1] = g.userData.t;
    g.scale(scale, scale, scale); g.translate(x, y, z);
    const yMin = y, yMax = y + 2.2 * scale;
    finish(g, (P, N, c) => {
      const t = Math.min(1, Math.max(0, (P.y - yMin) / (yMax - yMin)));
      const k = t0 + (t1 - t0) * 0.5;
      c.copy(baseC).lerp(tipC, Math.pow(Math.max(k, t), 1.3));
      return glow * Math.pow(Math.max(k, t), 2.0);
    });
  }
}
branchCoral(-3.3, 3.45, -2.5, 0.9, new THREE.Color(0.35, 0.18, 0.45), new THREE.Color(0.55, 0.75, 1.0), 11);
branchCoral(-2.1, 2.8, -1.9, 0.7, new THREE.Color(0.55, 0.30, 0.20), new THREE.Color(1.0, 0.75, 0.35), 23);
branchCoral(4.8, 2.4, -2.4, 0.85, new THREE.Color(0.20, 0.35, 0.30), new THREE.Color(0.55, 1.0, 0.65), 37);
branchCoral(-5.4, 1.0, -0.9, 0.55, new THREE.Color(0.45, 0.15, 0.30), new THREE.Color(1.0, 0.45, 0.7), 41, 3);
branchCoral(6.2, sandH(6.2, -0.8), -0.8, 0.6, new THREE.Color(0.4, 0.3, 0.5), new THREE.Color(0.85, 0.6, 1.0), 53, 3);

// brain coral
function brainCoral(x, z, r, sd) {
  const y = sandH(x, z) - 0.1;
  let g = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const f = fbm(v.x * 1.6 + sd, v.y * 1.6, v.z * 1.6, 3);
    const ridge = Math.pow(Math.abs(Math.sin(f * 22.0)), 0.6);
    v.multiplyScalar(1 + 0.045 * ridge);
    v.x *= r; v.y *= r * 0.75; v.z *= r;
    p.setXYZ(i, v.x + x, v.y + y, v.z + z);
  }
  g.computeVertexNormals();
  finish(g, (P) => {
    const q = new THREE.Vector3(P.x - x, (P.y - y) / 0.75, P.z - z).divideScalar(r);
    const f = fbm(q.x * 1.6 + sd, q.y * 1.6, q.z * 1.6, 3);
    const ridge = Math.abs(Math.sin(f * 22.0));
    return (new THREE.Color(0.35, 0.40, 0.12).lerp(new THREE.Color(0.85, 0.85, 0.45), ridge), 0) || 0;
  });
  // recolour (finish callback returns glow; colour must be set on c) -> redo properly
  const last = statics[statics.length - 1], pc = last.attributes.position, cc = last.attributes.color, gg = last.attributes.aGlow;
  for (let i = 0; i < pc.count; i++) {
    const qx = (pc.getX(i) - x) / r, qy = (pc.getY(i) - y) / (0.75 * r) / 1.0, qz = (pc.getZ(i) - z) / r;
    const f = fbm(qx * 1.6 + sd, qy * 1.6, qz * 1.6, 3);
    const ridge = Math.abs(Math.sin(f * 22.0));
    const c = new THREE.Color(0.30, 0.36, 0.10).lerp(new THREE.Color(0.80, 0.86, 0.48), ridge);
    cc.setXYZ(i, c.r, c.g, c.b); gg.setX(i, 0.12 * (1 - ridge));
  }
}
brainCoral(0.6, -0.4, 0.95, 3.3);
brainCoral(-6.4, -2.6, 0.6, 8.1);

// plate coral on right rocks
{
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(t * 1.0, 0.18 * t * t - 0.04 * Math.sin(t * 3.14))); }
  for (const [x, y, z, s, sd] of [[3.6, 1.9, -1.6, 1.0, 1], [5.4, 2.6, -2.2, 0.75, 2]]) {
    const g = new THREE.LatheGeometry(pts, 48);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i), r = Math.hypot(px, pz), a = Math.atan2(pz, px);
      p.setY(i, p.getY(i) + 0.08 * Math.sin(a * 5 + sd) * r + 0.05 * Math.sin(a * 11) * r * r);
    }
    g.scale(s, s, s); g.translate(x, y, z); g.computeVertexNormals();
    finish(g, (P, N, c) => { const r = Math.hypot(P.x - x, P.z - z) / s; c.setRGB(0.55, 0.35, 0.18).lerp(new THREE.Color(0.95, 0.72, 0.32), r); return 0.25 * r * r; });
  }
}
// sun coral polyps (tubes with glowing tips)
function tubes(x, y, z, n, sd, col, tip) {
  reseed(sd);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, rd = Math.sqrt(rnd()) * 0.35, h = rr(0.15, 0.4);
    const g = new THREE.CylinderGeometry(0.05, 0.06, h, 8, 1, true);
    g.translate(x + Math.cos(a) * rd, y + h / 2, z + Math.sin(a) * rd);
    finish(g, (P, N, c) => { const t = (P.y - y) / h; c.copy(col).lerp(tip, t); return 0.6 * t; });
    const t = new THREE.SphereGeometry(0.065, 8, 6); t.scale(1, 0.6, 1);
    t.translate(x + Math.cos(a) * rd, y + h, z + Math.sin(a) * rd);
    finish(t, (P, N, c) => { c.copy(tip); return 0.9; });
  }
}
tubes(-4.5, 3.15, -1.8, 14, 5, new THREE.Color(0.8, 0.45, 0.1), new THREE.Color(1.0, 0.85, 0.2));
tubes(3.0, 2.25, -2.1, 10, 9, new THREE.Color(0.2, 0.5, 0.45), new THREE.Color(0.4, 1.0, 0.8));
tubes(-1.4, 1.9, -1.4, 8, 13, new THREE.Color(0.6, 0.2, 0.5), new THREE.Color(1.0, 0.55, 0.9));

// starfish
function starfish(x, z, s, rot, col) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * Math.PI * 2 + rot, r = i % 2 === 0 ? 1.0 : 0.38;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) sh.moveTo(px, py); else sh.lineTo(px, py);
  }
  let g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.scale(s, s, s);
  g.translate(x, sandH(x, z) + 0.05, z);
  g.computeVertexNormals();
  finish(g, (P, N, c) => { const k = vnoise(P.x * 40, P.y * 40, P.z * 40); c.copy(col).multiplyScalar(0.85 + 0.25 * k); if (k > 0.6) c.setRGB(1, 0.9, 0.75); });
}
starfish(-1.6, 2.4, 0.42, 0.3, new THREE.Color(0.9, 0.28, 0.12));
starfish(5.4, 2.6, 0.32, 1.1, new THREE.Color(0.85, 0.55, 0.15));

// anemone bases + aerator stone
const ANEMONES = [{ x: 2.3, z: 0.3, r: 0.55, col: new THREE.Color(0.95, 0.55, 0.65), tip: new THREE.Color(1.0, 0.85, 0.95) },
                  { x: -2.5, z: -1.2, r: 0.42, y: 2.75, col: new THREE.Color(0.35, 0.75, 0.45), tip: new THREE.Color(0.85, 1.0, 0.55) }];
for (const a of ANEMONES) {
  a.y = a.y ?? sandH(a.x, a.z);
  const g = new THREE.CylinderGeometry(a.r * 0.9, a.r * 0.75, 0.35, 24, 1);
  g.translate(a.x, a.y + 0.1, a.z);
  finish(g, (P, N, c) => { c.copy(a.col).multiplyScalar(0.55); });
}
const AERATOR = new THREE.Vector3(-7.1, 0, 2.3); AERATOR.y = sandH(AERATOR.x, AERATOR.z) + 0.1;
{
  const g = new THREE.CylinderGeometry(0.22, 0.25, 0.25, 16); g.translate(AERATOR.x, AERATOR.y, AERATOR.z);
  finish(g, (P, N, c) => { c.setRGB(0.55, 0.6, 0.62); });
}

const staticMesh = new THREE.Mesh(mergeGeometries(statics), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }), {
  key: 'static', caustic: 1.0, near: 0.3, bump: 0.16, bumpFreq: '4.5',
  vHead: 'attribute float aGlow; varying float vGlow;', vert: 'vGlow = aGlow;',
  fHead: 'varying float vGlow;', emis: 'totalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlowK * (0.85 + 0.15 * sin(uTime * 0.7 + vWPos.x * 2.0)) + vec3(0.1, 0.6, 1.0) * vGlow * vGlow * uNight * 1.6;'
}));
scene.add(staticMesh);

// pebbles
{
  let g = new THREE.IcosahedronGeometry(1, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.25 * vnoise(x * 2, y * 2, z * 2); p.setXYZ(i, x * k, y * k * 0.6, z * k); }
  g.computeVertexNormals();
  const N = 260, m = new THREE.InstancedMesh(g, patch(new THREE.MeshStandardMaterial({ roughness: 0.6 }), { key: 'peb', caustic: 1.0, bump: 0.08, bumpFreq: '14.0' }), N);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  reseed(99);
  for (let i = 0; i < N; i++) {
    let x, z; do { x = rr(-7.7, 7.7); z = rr(-3.7, 3.7); } while (Math.hypot(x - 0.6, z + 0.4) < 1.0);
    const cl = rnd() < 0.5; if (cl) { x = rr(-1, 1) * 1.5 + (rnd() < 0.5 ? -1.5 : 3.5); z = rr(0.8, 3.2); }
    const s = rr(0.05, 0.16) * (rnd() < 0.08 ? 2 : 1);
    q.setFromEuler(new THREE.Euler(rr(-0.3, 0.3), rr(0, 6.3), rr(-0.3, 0.3)));
    M.compose(new THREE.Vector3(x, sandH(x, z) + s * 0.25, z), q, new THREE.Vector3(s, s, s));
    m.setMatrixAt(i, M);
    const t = rnd(); c.setRGB(0.6, 0.55, 0.5).lerp(t < 0.3 ? new THREE.Color(0.25, 0.25, 0.27) : t < 0.6 ? new THREE.Color(0.9, 0.85, 0.78) : new THREE.Color(0.7, 0.5, 0.38), rnd());
    m.setColorAt(i, c);
  }
  scene.add(m);
}

// ------------------------------------------------------------------ seaweed & seagrass (one InstancedMesh, swayed in vertex shader)
{
  const g = new THREE.PlaneGeometry(1, 1, 1, 18); g.translate(0, 0.5, 0);
  const blades = [];
  reseed(321);
  const kelp = (cx, cz, n, spread, hMin, hMax, w, c1, c2) => {
    for (let i = 0; i < n; i++) {
      const x = cx + rr(-spread, spread), z = cz + rr(-spread * 0.6, spread * 0.6);
      if (Math.abs(x) > W / 2 - 0.2 || Math.abs(z) > D / 2 - 0.2) continue;
      blades.push({ x, z, h: rr(hMin, hMax), w: w * rr(0.7, 1.3), ry: rr(0, Math.PI), c: c1.clone().lerp(c2, rnd()) });
    }
  };
  const G1 = new THREE.Color(0.08, 0.50, 0.14), G2 = new THREE.Color(0.40, 0.75, 0.16), R1 = new THREE.Color(0.85, 0.28, 0.2), R2 = new THREE.Color(0.95, 0.5, 0.25);
  kelp(-6.8, -3.2, 30, 1.0, 3.5, 7.6, 0.32, G1, G2);
  kelp(-1.8, -3.5, 10, 0.9, 3.0, 6.2, 0.26, G1, G2);
  kelp(6.6, -3.0, 26, 1.0, 3.0, 7.0, 0.30, G1, G2);
  kelp(0.8, -3.4, 12, 1.2, 2.0, 4.5, 0.26, R1, R2);
  kelp(-6.4, 0.6, 10, 0.7, 1.2, 2.5, 0.22, G2, new THREE.Color(0.7, 0.75, 0.2));
  kelp(1.8, -2.4, 8, 0.6, 1.0, 2.0, 0.2, R2, new THREE.Color(0.9, 0.5, 0.25));
  // seagrass meadows
  for (const [cx, cz, n] of [[-1.0, 1.0, 140], [5.0, 0.8, 110], [-5.0, 2.8, 90], [3.2, 3.0, 60]])
    kelp(cx, cz, n, 1.5, 0.35, 1.0, 0.05, new THREE.Color(0.25, 0.55, 0.15), new THREE.Color(0.55, 0.75, 0.25));
  const m = new THREE.InstancedMesh(g, patch(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), {
    key: 'weed', caustic: 0.7, near: 0.8,
    vHead: 'varying float vY;',
    vert: `
      vY = position.y;
      vec3 ip = instanceMatrix[3].xyz;
      float sc = length(instanceMatrix[1].xyz);
      float y = position.y;
      float ph = ip.x * 1.7 + ip.z * 2.3;
      transformed.x *= (0.35 + 0.9 * sin(3.14159 * min(y * 1.15 + 0.08, 1.0))) * (1.0 + 0.12 * sin(y * 30.0 + ph));
      float hw = y * y * sc;
      float sway = sin(uTime * 0.9 + ph + y * 2.5) * 0.22 + sin(uTime * 0.37 + ph * 0.5) * 0.18;
      vec3 off = vec3(uCurrent.x, 0.0, uCurrent.y) * (0.35 + sway) + vec3(-uCurrent.y, 0.0, uCurrent.x) * 0.3 * sin(uTime * 0.7 + ph + y * 3.0);
      mat3 rinv = mat3(instanceMatrix); rinv[0] /= dot(rinv[0], rinv[0]); rinv[1] /= dot(rinv[1], rinv[1]); rinv[2] /= dot(rinv[2], rinv[2]);
      transformed += transpose(rinv) * off * hw * 0.25;
    `,
    fHead: 'varying float vY;',
    color: `diffuseColor.rgb *= vColor * (0.55 + 0.6 * vY);`,
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * 0.22 * vY;'
  }), blades.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion();
  blades.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry);
    M.compose(new THREE.Vector3(b.x, sandH(b.x, b.z) - 0.05, b.z), q, new THREE.Vector3(b.w, b.h, 1));
    m.setMatrixAt(i, M); m.setColorAt(i, b.c);
  });
  scene.add(m);
}

// ------------------------------------------------------------------ anemone tentacles
const ANEM_STARTLE = { value: 0 }; let anemMat;
{
  const g = new THREE.CylinderGeometry(0.018, 0.04, 1, 5, 10, true); g.translate(0, 0.5, 0);
  const list = []; reseed(77);
  for (const a of ANEMONES) {
    const n = Math.round(160 * a.r / 0.55);
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, rd = Math.sqrt(rnd()) * a.r * 0.85;
      const x = a.x + Math.cos(ang) * rd, z = a.z + Math.sin(ang) * rd;
      const tilt = 0.25 + (rd / a.r) * 0.9;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(ang) * tilt, 0, -Math.cos(ang) * tilt));
      list.push({ p: new THREE.Vector3(x, a.y + 0.25, z), q, l: rr(0.45, 0.8) * a.r * 1.4, c: a.col, t: a.tip });
    }
  }
  const m = new THREE.InstancedMesh(g, patch(new THREE.MeshStandardMaterial({ roughness: 0.5 }), {
    key: 'anem', caustic: 0.6, vHead: 'varying float vY; uniform float uStartle;', uniforms: { uStartle: ANEM_STARTLE },
    vert: `
      vY = position.y;
      vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 9.1 + ip.z * 7.3;
      float y = position.y;
      transformed.y *= 1.0 - 0.55 * uStartle;
      transformed.x += (sin(uTime * 1.4 + ph + y * 3.0) * 0.18 + uCurrent.x * 0.15) * y * y;
      transformed.z += (cos(uTime * 1.1 + ph * 1.3 + y * 2.5) * 0.18 + uCurrent.y * 0.15) * y * y;
      transformed.xz *= 1.0 + 0.6 * smoothstep(0.85, 1.0, y);
    `,
    fHead: 'varying float vY;',
    color: 'diffuseColor.rgb = mix(vColor * 0.75, vec3(1.0, 0.95, 0.9) * mix(vColor, vec3(1.0), 0.5), smoothstep(0.6, 1.0, vY));',
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * (0.12 + 0.5 * smoothstep(0.75, 1.0, vY)) * (0.8 + 0.2 * sin(uTime * 2.0 + vWPos.x * 20.0)) * (1.0 + 1.4 * uNight);'
  }), list.length);
  anemMat = m.material;
  const M = new THREE.Matrix4();
  list.forEach((t, i) => { M.compose(t.p, t.q, new THREE.Vector3(1, t.l, 1)); m.setMatrixAt(i, M); m.setColorAt(i, t.c); });
  scene.add(m);
}

// ------------------------------------------------------------------ sea fan (gorgonian), gently swaying
{
  const parts = []; reseed(555);
  const fx = -0.6, fz = -3.35, fy = sandH(fx, fz) - 0.1;
  const br = (x, y, len, ang, rad, d) => {
    const x2 = x + Math.sin(ang) * len, y2 = y + Math.cos(ang) * len;
    const g = new THREE.CylinderGeometry(rad * 0.75, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0); g.rotateZ(-ang); g.translate(x, y, 0);
    parts.push(g);
    if (d < 6) {
      br(x2, y2, len * rr(0.72, 0.9), ang + rr(-0.6, -0.15), rad * 0.78, d + 1);
      br(x2, y2, len * rr(0.72, 0.9), ang + rr(0.15, 0.6), rad * 0.78, d + 1);
    }
  };
  br(0, 0, 0.7, 0, 0.07, 0);
  let g = mergeGeometries(parts.map(p => p.toNonIndexed()));
  g.deleteAttribute('uv');
  g.rotateY(0.25); g.translate(fx, fy, fz);
  const mat = patch(new THREE.MeshStandardMaterial({ color: 0x9a3a8a, roughness: 0.6, side: THREE.DoubleSide }), {
    key: 'fan', caustic: 0.8,
    vert: `float hy = max(position.y - ${fy.toFixed(3)}, 0.0); transformed.z += sin(uTime * 0.8 + position.x) * 0.04 * hy * hy + uCurrent.y * 0.02 * hy * hy;`,
    emis: 'totalEmissiveRadiance += vec3(0.25, 0.05, 0.22) * smoothstep(1.0, 4.0, vWPos.y);'
  });
  scene.add(new THREE.Mesh(g, mat));
}


// ------------------------------------------------------------------ water surface (seen from below & above) with interactive ripples
U.uSky = { value: new THREE.Color(0.75, 0.95, 1.0) };
U.uRayC = { value: new THREE.Color(0.75, 0.95, 1.0) };
const RIPPLE_GLSL = `
uniform vec4 uRip[8];
float ripH(vec2 p){
  float h = 0.0;
  for (int i = 0; i < 8; i++) {
    float age = uTime - uRip[i].z;
    if (age > 0.0 && age < 6.0) {
      float r = length(p - uRip[i].xy);
      float front = age * 1.6;
      h += uRip[i].w * sin(r * 7.0 - age * 9.0) * exp(-age * 0.75) * smoothstep(front + 0.2, front - 0.8, r) / (1.0 + r * 0.9);
    }
  }
  return h;
}`;
{
  const g = new THREE.PlaneGeometry(W - 0.02, D - 0.02, 128, 64); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: `uniform float uTime; varying vec3 vP;` + RIPPLE_GLSL + `
      float wv(vec2 p){ return sin(p.x * 1.3 + uTime * 1.1) * 0.035 + sin(p.y * 1.7 - uTime * 0.9 + p.x * 0.4) * 0.03 + sin((p.x + p.y) * 3.1 + uTime * 2.0) * 0.012; }
      void main(){ vec3 p = position; p.y += wv(p.xz) + ripH(p.xz); vec4 w = modelMatrix * vec4(p, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: WATER_GLSL + RIPPLE_GLSL + `uniform vec3 uSky; varying vec3 vP;
      float h(vec2 p){ return sin(p.x * 1.3 + uTime * 1.1) * 0.035 + sin(p.y * 1.7 - uTime * 0.9 + p.x * 0.4) * 0.03 + sin((p.x + p.y) * 3.1 + uTime * 2.0) * 0.012
        + 0.01 * sin(p.x * 7.0 - uTime * 2.7 + sin(p.y * 5.0)) + 0.008 * sin(p.y * 9.0 + uTime * 3.1 + p.x); }
      void main(){
        float e = 0.05;
        float r0 = ripH(vP.xz), rx = ripH(vP.xz + vec2(e, 0.)), rz = ripH(vP.xz + vec2(0., e));
        vec3 n = normalize(vec3(h(vP.xz - vec2(e,0.)) - h(vP.xz + vec2(e,0.)) + 2.0 * (r0 - rx), 2.0 * e, h(vP.xz - vec2(0.,e)) - h(vP.xz + vec2(0.,e)) + 2.0 * (r0 - rz)));
        float rip = clamp(abs(rx - r0) * 60.0 + abs(rz - r0) * 60.0, 0.0, 1.0);
        vec3 v = normalize(cameraPosition - vP);
        vec3 col; float a;
        if (cameraPosition.y < vP.y) {
          float c = abs(dot(v, -n));
          float tir = smoothstep(0.55, 0.25, c);
          vec3 refl = waterColor(uBoxMax.y * 0.7) * 1.1;
          vec3 sky = uSky * 1.6;
          col = mix(sky, refl, tir);
          float sp = causticT(vP.xz * 0.12, uTime * 0.6);
          col += uSky * vec3(0.8, 0.95, 1.0) * sp * 0.8 + uSky * rip * 0.9;
          col = waterApply(col, vP);
          a = 0.92;
        } else {
          float f = 0.02 + 0.98 * pow(1.0 - max(dot(v, n), 0.0), 5.0);
          vec3 r = reflect(-v, n);
          float spec = pow(max(dot(r, normalize(vec3(0.2, 1.0, 0.3))), 0.0), 120.0);
          col = mix(uShallow * 0.6, uSky * 0.8, f) + spec * 2.0 * uSky + rip * 0.25 * uSky;
          a = 0.25 + 0.55 * f + spec;
        }
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const s = new THREE.Mesh(g, mat); s.position.y = HS; s.renderOrder = 2; scene.add(s);
}
let ripIdx = 0;
function ripple(x, z, amp = 0.06) { U.uRip.value[ripIdx].set(x, z, U.uTime.value, amp); ripIdx = (ripIdx + 1) % 8; }

// ------------------------------------------------------------------ god rays (colour/intensity follow the light preset)
{
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vP; varying float vH; attribute float aSeed; varying float vS;
      void main(){ vH = uv.y; vS = aSeed; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uRayC; uniform float uTurb; uniform vec3 uBoxMax; varying vec3 vN; varying vec3 vP; varying float vH; varying float vS;
      void main(){
        vec3 v = normalize(cameraPosition - vP);
        float edge = pow(abs(dot(v, vN)), 2.5);
        float fade = smoothstep(0.0, 0.7, vH) * smoothstep(1.0, 0.92, vH);
        float fl = 0.55 + 0.45 * sin(uTime * 0.35 + vS * 6.0) * sin(uTime * 0.21 + vS * 3.0 + vP.y * 0.3);
        float streak = 0.6 + 0.4 * sin(atan(vN.z, vN.x) * 9.0 + vS * 10.0 + uTime * 0.1);
        // A-03 step 2: shafts need particles to scatter (more with turbidity, saturating), and turbid water attenuates the beam with depth.
        // Relative to the default turbidity uTurb = 1, so the default look is unchanged; 0.447 = AQ_SCAT, 0.19 = AQ_M (core.js).
        float z = max(uBoxMax.y - vP.y, 0.0), tk = uTurb / (0.6 + 0.4 * uTurb) * exp(-1.5 * 0.447 * 0.19 * (uTurb - 1.0) * z);
        float a = edge * fade * fl * streak * 0.085 * tk;
        gl_FragColor = vec4(uRayC * a, 1.0);
      }`
  });
  const geos = []; reseed(4242);
  for (let i = 0; i < 7; i++) {
    const rt = rr(0.4, 0.9), rb = rt * rr(1.6, 2.4), h = HS - 0.3;
    const g = new THREE.CylinderGeometry(rt, rb, h, 20, 1, true);
    g.translate(0, -h / 2, 0);
    g.rotateZ(-Math.atan2(SUN.x, SUN.y) * 0.9); g.rotateX(Math.atan2(SUN.z, SUN.y) * 0.9);
    g.translate(-6 + i * 2.0 + rr(-0.5, 0.5), HS, rr(-2.5, 1.5));
    const sd = new Float32Array(g.attributes.position.count).fill(rnd());
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  const rays = new THREE.Mesh(mergeGeometries(geos), mat); rays.renderOrder = 5; scene.add(rays);
}

// ------------------------------------------------------------------ marine snow + bioluminescent plankton (GPU-animated points)
{
  const N = 1500, pos = new Float32Array(N * 3), sz = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = rr(-W / 2, W / 2); pos[i * 3 + 1] = rr(0, HS); pos[i * 3 + 2] = rr(-D / 2, D / 2); sz[i] = rr(0.5, 1.0) * (rnd() < 0.05 ? 2.2 : 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform float uPR; uniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform vec2 uDrift; uniform float uNight; uniform float uTurb;
      attribute float aSize; varying float vA; varying float vGlow;
      void main(){
        vec3 p = position;
        float s = p.x * 3.1 + p.z * 1.7 + p.y;
        p += vec3(sin(uTime * 0.13 + s) * 0.4, -uTime * 0.05 + sin(uTime * 0.2 + s * 2.0) * 0.15, cos(uTime * 0.11 + s * 1.3) * 0.3);
        p.xz += uDrift;
        vec3 mn = uBoxMin + vec3(0.05, 0.6, 0.05), sz = uBoxMax - mn - vec3(0.05, 0.1, 0.05);
        p = mn + mod(p - mn, sz);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float glowing = step(0.62, fract(s * 7.31));                       // ~40% of particles are plankton
        float tw = pow(0.5 + 0.5 * sin(uTime * (1.2 + fract(s * 3.7) * 2.0) + s * 11.0), 6.0);
        vGlow = glowing * uNight * (0.35 + 1.6 * tw);
        gl_PointSize = min(aSize * uPR * 34.0 / -mv.z * (1.0 + vGlow * 0.6), 14.0 * uPR);
        vA = (0.25 + 0.35 * smoothstep(2.0, 8.0, p.y)) * smoothstep(40.0, 12.0, -mv.z) * (1.0 - 0.6 * uNight) * (0.55 + 0.45 * uTurb) * smoothstep(0.4, 2.0, -mv.z);
        vGlow *= smoothstep(0.4, 2.0, -mv.z);
      }`,
    fragmentShader: `varying float vA; varying float vGlow; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
      float a = smoothstep(0.25, 0.0, d);
      vec3 col = vec3(0.75, 0.9, 0.95) * a * vA + vec3(0.25, 1.0, 0.85) * a * a * vGlow * 0.9;
      gl_FragColor = vec4(col, 1.0); }`
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts);
}
export { AERATOR, ANEM_STARTLE, ANEMONES, lampMat, ripple, sandH };
