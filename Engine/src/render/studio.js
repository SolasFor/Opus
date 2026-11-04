/* Студийное окружение для отражений (M-07a) вместо RoomEnvironment: тёмно-серая студия с софтбоксами
 * и световыми полосами, чтобы металл давал длинные мягкие блики, как на предметной съёмке. render/scene.js
 * строит из него карту окружения (PMREM).
 * GAIN = 0,92 — множитель яркости окружения и источников света в scene.js. Прототип M-07 снимался с экспозицией 0,92;
 * экспозиция осталась 1,0, а свет и окружение умножены на 0,92. Освещённые детали выглядят как в прототипе,
 * а свечение тактов, подсветка выбора и частицы — как раньше.
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
    box(0x6a6f76, 1.0, [0, 6, 0], [40, 24, 40]);              // стены студии (средне-серые)
    box(0x34363a, 1.0, [0, -5.9, 0], [40, 0.2, 40]);          // пол
    box(0xfff4e8, 6.0, [2, 14, 3], [22, 0.2, 14], F);         // большой верхний софтбокс (ключевой)
    box(0xeef3ff, 4.0, [-15, 6, 2], [0.2, 12, 5], F);         // левая световая полоса
    box(0xeef3ff, 3.5, [15, 5, -4], [0.2, 11, 4], F);         // правая полоса (контровая)
    box(0xffffff, 2.5, [5, 4, 16], [16, 6, 0.2], F);          // фронтальная заполняющая панель
    box(0xa8dcff, 2.0, [-6, 7, -16], [16, 3, 0.2], F);        // холодный контровой сзади
    box(0xffffff, 1.2, [0, -1.5, 14], [28, 1.6, 0.2], F);     // нижняя полоса, подсвечивает низ
    this.dispose = () => { geo.dispose(); mats.forEach(m => m.dispose()); };
  }
}

export { GAIN, StudioEnvironment };
