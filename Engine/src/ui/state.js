/* Состояние интерфейса ui; effSpeed() — скорость модели с учётом замедления; raycaster и список pickables для выбора
 * деталей; реестр элементов страницы el (заполняет initUI()).
 * M-02c: начало раздела 10 Engine/src/main.js, дословно. Совпадение со строками main.js@a463fb8
 * проверяет tests/split-sync.test.js.
 * Строки связки setSpeedSource(effSpeed) и setEffectsSource(ui, effSpeed) остаются в main.js.
 */
import * as THREE from 'three';
import { sim } from '../render/kinematics.js';

const ui = {
  explode: 0, explodeTw: null, stepMode: false, step: -1,
  view: 'solid', cutZ: 0, labels: false, autoRotate: false,
  selected: null, hover: null, isolated: null, pvCyl: 0,
  scrubbing: false, wasRunning: false, firstRun: true, lastInteract: 0, camTw: null,
  pointer: new THREE.Vector2(), pointerPx: { x: 0, y: 0 }, needHover: false, down: null, dragging: false
};
const effSpeed = () => sim.speed * (sim.slow ? 0.2 : 1);
const raycaster = new THREE.Raycaster();
let pickables = [];
const el = {};

export { ui, effSpeed, raycaster, pickables, el };
