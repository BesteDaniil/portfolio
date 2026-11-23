import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, createCursors, getActionDuration, ACTION_ORDER, ACTION_ROLE } from "../js/timeline.js";
import { sampleTextPoints, layoutText, isInsideText, heartPoints, isInsideHeart, isInsideHeartShape, matchPoints, halton } from "../js/shapes.js";
import { linear, easeInOutCubic, easeOutCubic, quadraticPoint, progress } from "../js/easing.js";

/* Первый экран: шапка, кнопки, цифры — как их отдаёт assemble.js */
const BLOCKS = [
  { id: "hero", actions: ["frame", "reveal"] },
  { id: "name", actions: ["frame", "text", "check"], chars: 6 },
  { id: "role", actions: ["frame", "text", "check"], chars: 34 },
  { id: "lead", actions: ["frame", "text", "check"], chars: 160 },
  { id: "btn-work", actions: ["frame", "text", "color", "check"], chars: 15 },
  { id: "btn-tg", actions: ["frame", "text", "color", "check"], chars: 19 },
  { id: "avatar", actions: ["frame", "image", "check"] },
  { id: "stat-1", actions: ["frame", "text", "color", "check"], chars: 14 },
  { id: "stat-2", actions: ["frame", "text", "color", "check"], chars: 10 },
  { id: "stat-3", actions: ["frame", "text", "color", "check"], chars: 16 },
  // Как карточка цены: все действия, кроме картинки
  { id: "card", actions: ["frame", "reveal", "text", "color", "check"], chars: 40 }
];

function stepsOf(timeline, element) {
  return timeline.steps.filter(function (step) {
    return step.element === element;
  });
}

test("хореография: у каждого блока действия идут по порядку и каждое — ровно один раз", function () {
  const timeline = buildTimeline(BLOCKS, createCursors(18), { limit: 5000, travel: 200 });
  for (const block of BLOCKS) {
    const own = stepsOf(timeline, block.id);
    // Порядок — записан здесь явно, а не взят из кода: рамка → появление → текст → цвет → картинка → галочка
    assert.deepEqual(own.map(function (step) { return step.action; }), ["frame", "reveal", "text", "color", "image", "check"].filter(function (action) {
      return block.actions.includes(action);
    }), block.id);
    assert.equal(ACTION_ORDER.length, 6);
    for (let index = 1; index < own.length; index++) {
      assert.ok(own[index].start >= own[index - 1].start + own[index - 1].duration - 1e-9, block.id + ": " + own[index].action + " раньше, чем закончилось " + own[index - 1].action);
    }
  }
});

test("хореография: галочка «тесты» — только после того, как блок собран целиком", function () {
  const timeline = buildTimeline(BLOCKS, createCursors(18), { limit: 5000 });
  for (const block of BLOCKS) {
    const own = stepsOf(timeline, block.id);
    const check = own.find(function (step) { return step.action === "check"; });
    if (!check) {
      continue;
    }
    for (const step of own) {
      if (step !== check) {
        assert.ok(step.start + step.duration <= check.start + 1e-9, block.id);
      }
    }
  }
});

test("хореография: действие делает курсор своей роли, один курсор не делает два дела сразу", function () {
  const cursors = createCursors(18);
  const roleOf = new Map(cursors.map(function (cursor) { return [cursor.id, cursor.role]; }));
  const timeline = buildTimeline(BLOCKS, cursors, { limit: 5000, travel: 200 });
  const lastEnd = new Map();
  for (const step of timeline.steps.slice().sort(function (a, b) { return a.start - b.start; })) {
    assert.equal(roleOf.get(step.cursor), ACTION_ROLE[step.action], step.element + " " + step.action);
    if (lastEnd.has(step.cursor)) {
      assert.ok(step.start >= lastEnd.get(step.cursor) - 1e-9, step.cursor + " занят");
    }
    lastEnd.set(step.cursor, step.start + step.duration);
  }
});

test("хореография: первый экран укладывается в лимит, шаги — по времени начала", function () {
  for (const count of [18, 8]) {
    const timeline = buildTimeline(BLOCKS, createCursors(count), { limit: 5000, travel: 200 });
    assert.ok(timeline.total <= 5000 + 1e-9, count + " курсоров: " + timeline.total);
    for (const step of timeline.steps) {
      assert.ok(step.start + step.duration <= 5000 + 1e-9);
      assert.ok(step.duration > 0);
    }
    for (let index = 1; index < timeline.steps.length; index++) {
      assert.ok(timeline.steps[index].start >= timeline.steps[index - 1].start);
    }
  }
  // Короткий лимит: всё сжимается, а не обрезается
  const tight = buildTimeline(BLOCKS, createCursors(8), { limit: 1500 });
  assert.ok(tight.total <= 1500 + 1e-9);
  assert.equal(tight.steps.length, buildTimeline(BLOCKS, createCursors(8), {}).steps.length);
});

test("хореография: одно и то же на входе — одно и то же расписание", function () {
  assert.deepEqual(buildTimeline(BLOCKS, createCursors(18), { limit: 5000 }), buildTimeline(BLOCKS, createCursors(18), { limit: 5000 }));
});

test("курсоры: 18 на ПК, 8 на телефоне, все шесть ролей, «тесты» — один", function () {
  for (const count of [18, 8]) {
    const cursors = createCursors(count);
    assert.equal(cursors.length, count);
    assert.equal(new Set(cursors.map(function (cursor) { return cursor.id; })).size, count);
    assert.equal(new Set(cursors.map(function (cursor) { return cursor.role; })).size, 6);
    assert.equal(cursors.filter(function (cursor) { return cursor.role === "tests"; }).length, 1);
  }
});

test("хореография: печать дольше у длинного текста, но в разумных пределах", function () {
  assert.ok(getActionDuration("text", { chars: 160 }) > getActionDuration("text", { chars: 10 }));
  assert.ok(getActionDuration("text", { chars: 100000 }) <= 1100);
  assert.ok(getActionDuration("text", { chars: 0 }) >= 200);
});

test("рой: sampleTextPoints — ровно N точек, все внутри букв", function () {
  for (const count of [1, 150, 420, 500]) {
    const points = sampleTextPoints("НАПИСАТЬ", 900, 160, count);
    assert.equal(points.length, count);
    const layout = layoutText("НАПИСАТЬ", 900, 160);
    for (const point of points) {
      assert.ok(isInsideText(layout, point), JSON.stringify(point));
      assert.ok(point.x >= 0 && point.x <= 900 && point.y >= 0 && point.y <= 160);
    }
  }
  assert.deepEqual(sampleTextPoints("НАПИСАТЬ", 900, 160, 0), []);
});

test("рой: буквы заполнены равномерно — в каждой есть точки", function () {
  const layout = layoutText("НАПИСАТЬ", 900, 160);
  const points = sampleTextPoints("НАПИСАТЬ", 900, 160, 300);
  const letterWidth = 6 * layout.size;
  const left = (900 - (8 * 5 + 7) * layout.size) / 2;
  const perLetter = new Array(8).fill(0);
  for (const point of points) {
    perLetter[Math.min(7, Math.floor((point.x - left) / letterWidth))]++;
  }
  for (const count of perLetter) {
    assert.ok(count >= 20, perLetter.join(","));
  }
});

test("рой: «ДЛЯ ВАС» — все шесть букв заполнены, в узком пробеле пусто", function () {
  const width = 900;
  const height = 160;
  const layout = layoutText("ДЛЯ ВАС", width, height);
  // 6 букв по 5 клеток + пробел в 2 клетки + 6 промежутков
  const columns = 6 * 5 + 2 + 6;
  assert.ok(Math.abs(layout.size - Math.min(width / columns, height / 7)) < 1e-9);
  const left = (width - columns * layout.size) / 2;
  const starts = [0, 6, 12, 18, 21, 27, 33];
  const points = sampleTextPoints("ДЛЯ ВАС", width, height, 300);
  const perSlot = new Array(starts.length).fill(0);
  for (const point of points) {
    assert.ok(isInsideText(layout, point), JSON.stringify(point));
    const column = (point.x - left) / layout.size;
    let slot = 0;
    while (slot + 1 < starts.length && column >= starts[slot + 1]) {
      slot++;
    }
    perSlot[slot]++;
  }
  assert.equal(perSlot[3], 0, "пробел: " + perSlot.join(","));
  perSlot.forEach(function (count, slot) {
    if (slot !== 3) {
      assert.ok(count >= 20, perSlot.join(","));
    }
  });
});

test("рой: в буквах ровная сетка — одинаковые места в каждой клетке, штрихи ровные", function () {
  for (const [count, perSide] of [[420, 2], [150, 1], [60, 1]]) {
    const layout = layoutText("ДЛЯ ВАС", 1000, 200);
    const points = sampleTextPoints("ДЛЯ ВАС", 1000, 200, count);
    // Положение точки внутри её клетки — только из сетки k×k (центры подклеток)
    const offsets = new Set();
    for (const point of points) {
      const cell = layout.cells.find(function (item) {
        return point.x >= item.x && point.x < item.x + item.size && point.y >= item.y && point.y < item.y + item.size;
      });
      const fx = (point.x - cell.x) / cell.size * perSide - 0.5;
      const fy = (point.y - cell.y) / cell.size * perSide - 0.5;
      assert.ok(Math.abs(fx - Math.round(fx)) < 1e-6 && Math.abs(fy - Math.round(fy)) < 1e-6, count + ": " + JSON.stringify(point));
      offsets.add(Math.round(fx) + "," + Math.round(fy));
    }
    assert.equal(offsets.size, perSide * perSide, String(count));
    // Мест занято столько, сколько возможно: повторы — только когда точек больше, чем мест
    const distinct = new Set(points.map(function (point) { return point.x.toFixed(6) + "," + point.y.toFixed(6); })).size;
    assert.equal(distinct, Math.min(count, layout.cells.length * perSide * perSide), String(count));
  }
});

test("рой: heartPoints — ровно N точек, все внутри сердца", function () {
  for (const count of [1, 150, 420, 500]) {
    const points = heartPoints(count);
    assert.equal(points.length, count);
    for (const point of points) {
      assert.ok(isInsideHeart(point), JSON.stringify(point));
    }
  }
  assert.equal(isInsideHeartShape(0, 0), true);
  assert.equal(isInsideHeartShape(1.1, 1.2), false);
  assert.equal(isInsideHeartShape(0, -1.2), false, "ниже острия");
  // Сердце не перевёрнуто: верхние «лопасти» внутри, та же точка внизу — снаружи
  assert.equal(isInsideHeartShape(0.6, 0.9), true, "лопасть");
  assert.equal(isInsideHeartShape(0.6, -0.9), false, "у острия по бокам пусто");
  // В единичном квадрате (y вниз) верх сердца шире низа
  const points = heartPoints(400);
  const top = points.filter(function (point) { return point.y < 0.4; });
  const bottom = points.filter(function (point) { return point.y > 0.7; });
  const spread = function (list) {
    return Math.max(...list.map(function (point) { return point.x; })) - Math.min(...list.map(function (point) { return point.x; }));
  };
  assert.ok(spread(top) > spread(bottom) * 1.5);
});

test("рой: сердце заполнено по площади, а не только по краю", function () {
  const points = heartPoints(400);
  const center = points.filter(function (point) {
    return Math.abs(point.x - 0.5) < 0.15 && point.y > 0.3 && point.y < 0.6;
  }).length;
  assert.ok(center > 25, "в середине " + center);
});

test("рой: сопоставление — перестановка без повторов, левое летит в левое", function () {
  const from = sampleTextPoints("НАПИСАТЬ", 900, 160, 300);
  const to = heartPoints(300).map(function (point) {
    return { x: 300 + point.x * 300, y: point.y * 160 };
  });
  const mapping = matchPoints(from, to);
  assert.equal(mapping.length, 300);
  assert.deepEqual(mapping.slice().sort(function (a, b) { return a - b; }), Array.from({ length: 300 }, function (value, index) { return index; }));
  // Порядок слева направо сохраняется: кто левее в слове, тот левее в сердце
  const order = from.map(function (point, index) { return index; }).sort(function (a, b) {
    return from[a].x - from[b].x || from[a].y - from[b].y || a - b;
  });
  for (let index = 1; index < order.length; index++) {
    assert.ok(to[mapping[order[index]]].x >= to[mapping[order[index - 1]]].x);
  }
  // Пути короче, чем у случайного распределения
  function distance(map) {
    let sum = 0;
    from.forEach(function (point, index) {
      sum += Math.hypot(point.x - to[map[index]].x, point.y - to[map[index]].y);
    });
    return sum;
  }
  const shuffled = mapping.slice().reverse();
  assert.ok(distance(mapping) < distance(shuffled) * 0.7);
});

test("рой: последовательность Халтона в [0, 1) и без повторов", function () {
  const seen = new Set();
  for (let index = 1; index < 500; index++) {
    const value = halton(index, 3);
    assert.ok(value >= 0 && value < 1);
    seen.add(value);
  }
  assert.equal(seen.size, 499);
});

test("easing: начало 0, конец 1, без выхода за края, монотонно", function () {
  for (const ease of [linear, easeInOutCubic, easeOutCubic]) {
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
    assert.equal(ease(-3), 0);
    assert.equal(ease(7), 1);
    assert.equal(ease(Number.NaN), 0);
    let previous = 0;
    for (let index = 1; index <= 100; index++) {
      const value = ease(index / 100);
      assert.ok(value >= previous - 1e-12);
      previous = value;
    }
  }
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.ok(easeOutCubic(0.25) > 0.25, "быстрый старт");
  assert.ok(easeInOutCubic(0.25) < 0.25, "мягкий разгон");
});

test("easing: дуга Безье и доля пути", function () {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  assert.deepEqual(quadraticPoint(from, { x: 5, y: 10 }, to, 0), from);
  assert.deepEqual(quadraticPoint(from, { x: 5, y: 10 }, to, 1), to);
  assert.deepEqual(quadraticPoint(from, { x: 5, y: 10 }, to, 0.5), { x: 5, y: 5 });
  assert.equal(progress(150, 100, 100), 0.5);
  assert.equal(progress(50, 100, 100), 0);
  assert.equal(progress(500, 100, 100), 1);
  assert.equal(progress(100, 100, 0), 1);
});
