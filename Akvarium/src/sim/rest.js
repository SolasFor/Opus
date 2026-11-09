/**
 * A-04 — ночной отдых и укрытия (стилизованная модель, aquarium-ecosystem → ecosystem-models §6.2).
 * Без three и DOM: модуль работает в Node и проверяется отдельно (tests/rest.test.js). Параметры — REST в
 * config/ecosystem.js. Вес отдыха r ∈ [0, 1] плавно (smoothstep) растёт с «Ночью» от порога on до 1: днём и на
 * закате (0,22) r = 0, и все функции возвращают прежние значения, поэтому дневное поведение не меняется.
 * Ночью верхний предел скорости сдвигается к нижнему (активность 1 − act·r), точка стаи стягивается к укрытию над
 * рифом, одиночные рыбы выбирают точку у бока камня, клоуны держатся ближе к анемону.
 * Это стилизация: дневные рифовые рыбы ночью прячутся в кораллах и щелях и почти не плавают (ecosystem-models §2),
 * но точки укрытий и числа подобраны на глаз. Функции не выделяют память: пишут в переданный out и возвращают его.
 */
import { REST } from '../config/ecosystem.js';

function restWeight(night) {
  const t = (night - REST.on) / (1 - REST.on);
  if (!(t > 0)) return 0;   // день, закат и некорректное значение
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

// верхний предел скорости вида: прежний hi при r = 0, ночью ближе к нижнему lo (но не ниже его)
function speedHi(lo, hi, r) {
  return hi - (hi - lo) * REST.act * r;
}

// точка стаи: дневная att при r = 0, ночью стягивается к укрытию (доля pull при r = 1); out может совпадать с att
function restAttractor(att, shelter, r, out) {
  const k = REST.pull * r;
  out.x = att.x + (shelter.x - att.x) * k;
  out.y = att.y + (shelter.y - att.y) * k;
  out.z = att.z + (shelter.z - att.z) * k;
  return out;
}

// укрытие стаи — над верхом камня o = [x, y, z, радиус]
function shelterTop(o, out) {
  out.x = o[0]; out.y = o[1] + o[3] + REST.above; out.z = o[2];
  return out;
}

// укрытие одиночной рыбы — у бока камня в направлении угла a (плоскость xz), чуть выше его центра
function shelterSide(o, a, out) {
  const d = o[3] + REST.gap;
  out.x = o[0] + Math.cos(a) * d; out.y = o[1] + REST.sideY; out.z = o[2] + Math.sin(a) * d;
  return out;
}

// доля дневного разброса цели клоунов вокруг анемона: 1 днём, spread при r = 1
function homeSpread(r) {
  return 1 - (1 - REST.spread) * r;
}

export { restWeight, speedHi, restAttractor, shelterTop, shelterSide, homeSpread };
