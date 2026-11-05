/* M-06a: карта теней по требованию. three.js по умолчанию заново рисует карту теней (2048², PCFSoft) в каждом кадре,
 * даже на паузе, когда ничего не движется. Здесь карта перерисовывается, только если изменилось то, что в неё
 * попадает: матрицы видимых объектов, отбрасывающих тень (у InstancedMesh — и матрицы экземпляров), их геометрия,
 * видимость, положение источника света с тенью и его цели. Снимок этих чисел сравнивается с прошлым кадром точно,
 * без хеша. Камера в карту теней не входит: вращение камеры и автоповорот её не перерисовывают.
 * Первый кадр и кадр после восстановления WebGL-контекста (three.js создаёт новый renderer.shadowMap) рисуют карту
 * всегда. Сама картинка не меняется: карта та же, что получилась бы при перерисовке.
 * Модуль не импортирует three.js и scene.js: рендерер и сцена передаются аргументами (gl и root), поэтому
 * tests/perf.test.js проверяет его на объектах-заглушках в Node.
 */

let map = null, snap = new Float64Array(4096), len = 0, at = 0, changed = false;
const put = v => {
  if (at === snap.length) { const s = new Float64Array(snap.length * 2); s.set(snap); snap = s; }
  if (at >= len || snap[at] !== v) { changed = true; snap[at] = v; }
  at++;
};
const putMatrix = m => { const e = m.elements; for (let k = 0; k < 16; k++) put(e[k]); };
function visit(o) {
  if (o.isLight) {
    if (!o.castShadow) return;
    put(o.id); putMatrix(o.matrixWorld);
    if (o.target) putMatrix(o.target.matrixWorld);
    return;
  }
  if (!o.castShadow || !(o.isMesh || o.isLine || o.isPoints)) return;
  put(o.id); put(o.geometry.id); putMatrix(o.matrixWorld);
  if (o.isInstancedMesh) {
    const a = o.instanceMatrix.array, n = o.count * 16;
    put(o.count);
    for (let k = 0; k < n; k++) put(a[k]);
  }
}
/* вызывается перед renderer.render(): решает, перерисовать ли карту теней в этом кадре; возвращает решение */
function updateShadows(gl, root) {
  const sm = gl.shadowMap;
  changed = false; at = 0;
  if (sm !== map) { map = sm; map.autoUpdate = false; changed = true; }
  root.updateMatrixWorld();
  root.traverseVisible(visit);
  if (at !== len) { changed = true; len = at; }
  if (changed) sm.needsUpdate = true;
  return changed;
}

export { updateShadows };
