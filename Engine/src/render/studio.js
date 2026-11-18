/* Студийное окружение для отражений (автомобильная предметная съёмка): тёмно-графитовый зал,
 * большой верхний октабокс, высококонтрастные боковые световые полосы для длинных бликов на фрезерованных
 * поверхностях и карбоне, холодный контровой свет и мягкая нижняя подсветка.
 */
import * as THREE from 'three';

const GAIN = 0.92;
class StudioEnvironment extends THREE.Scene {
  constructor() {
    super();
    const geo = new THREE.BoxGeometry(1, 1, 1), mats = [];
    const box = (c, k, p, s, side = THREE.BackSide) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k * GAIN), side });
      mats.push(m);
      const o = new THREE.Mesh(geo, m);
      o.position.set(...p); o.scale.set(...s);
      this.add(o);
    };
    const F = THREE.FrontSide;
    box(0x5d646e, 1.0, [0, 6.5, 0], [46, 26, 46]);               // стены студии
    box(0x2d3036, 1.0, [0, -6.2, 0], [46, 0.2, 46]);             // пол студии
    box(0xfff6ec, 6.8, [1.5, 15, 2], [26, 0.2, 16], F);          // верхний октабокс (ключевой)
    box(0xeef4ff, 4.8, [-17, 6.5, 2.5], [0.2, 13, 6], F);        // левая световая полоса
    box(0xf4f7ff, 4.2, [17, 5.5, -4], [0.2, 12, 5], F);          // правая контровая полоса
    box(0xffffff, 2.8, [6, 4.5, 18], [18, 6.5, 0.2], F);         // фронтальная заполняющая панель
    box(0x9ad8ff, 2.6, [-7, 7.5, -18], [18, 3.5, 0.2], F);       // холодный контровой сзади
    box(0xffe6cc, 1.5, [0, -1.8, 15], [32, 1.8, 0.2], F);        // тёплая нижняя отражающая полоса
    this.dispose = () => { geo.dispose(); mats.forEach(m => m.dispose()); };
  }
}

export { GAIN, StudioEnvironment };
