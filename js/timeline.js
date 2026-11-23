/* ==========================================================
   Хореография сборки — чистые функции без DOM (тестируются в Node).
   На входе — блоки страницы (что с каждым сделать) и курсоры с ролями,
   на выходе — шаги { cursor, action, element, start, duration } в миллисекундах.

   Правила:
   - у каждого блока действия идут по порядку: рамка → появление → текст → цвет → картинка → галочка;
   - действие делает курсор своей роли; один курсор не делает два дела сразу,
     между делами — перелёт (travel);
   - «тесты» ставят галочку, только когда блок собран целиком;
   - всё вместе укладывается в limit: если не влезает, расписание сжимается.
   ========================================================== */

/* Роли курсоров: подпись на курсоре и цвет (CSS-переменная задаёт сам цвет) */
export const ROLES = [
  { id: "layout", label: "вёрстка" },
  { id: "animation", label: "анимация" },
  { id: "text", label: "текст" },
  { id: "color", label: "цвет" },
  { id: "images", label: "картинки" },
  { id: "tests", label: "тесты" }
];

export const ACTION_ORDER = ["frame", "reveal", "text", "color", "image", "check"];

export const ACTION_ROLE = {
  frame: "layout",
  reveal: "animation",
  text: "text",
  color: "color",
  image: "images",
  check: "tests"
};

/* Сколько курсоров каждой роли: на ПК 18, на телефоне 8. «Тесты» — всегда один, это главный курсор */
const CREW = {
  18: { layout: 5, animation: 2, text: 5, color: 2, images: 3, tests: 1 },
  8: { layout: 2, animation: 1, text: 2, color: 1, images: 1, tests: 1 }
};

export function createCursors(count) {
  const crew = CREW[count] || CREW[18];
  const cursors = [];
  for (const role of ROLES) {
    for (let index = 0; index < crew[role.id]; index++) {
      cursors.push({ id: role.id + "-" + (index + 1), role: role.id, label: role.label });
    }
  }
  return cursors;
}

/* Базовые длительности действий, мс; печать зависит от длины текста */
const DURATION = { frame: 420, reveal: 260, color: 320, image: 480, check: 180 };
const TEXT_MIN = 220;
const TEXT_MAX = 1100;
const TEXT_PER_CHAR = 12;

export function getActionDuration(action, block) {
  if (action === "text") {
    const chars = Math.max(0, block.chars || 0);
    return Math.max(TEXT_MIN, Math.min(TEXT_MAX, 120 + chars * TEXT_PER_CHAR));
  }
  return DURATION[action] || 0;
}

/* blocks: [{ id, actions: ["frame", "text", …], chars }] — в порядке документа.
   cursors: [{ id, role }]. options: { limit, travel }.
   Возвращает { steps, total } — шаги по времени начала, total ≤ limit. */
export function buildTimeline(blocks, cursors, options) {
  const settings = options || {};
  const limit = settings.limit > 0 ? settings.limit : Infinity;
  const travel = settings.travel >= 0 ? settings.travel : 200;
  const freeAt = new Map();
  const byRole = new Map();
  for (const cursor of cursors) {
    freeAt.set(cursor.id, null);
    if (!byRole.has(cursor.role)) {
      byRole.set(cursor.role, []);
    }
    byRole.get(cursor.role).push(cursor);
  }

  const steps = [];
  blocks.forEach(function (block, blockIndex) {
    let ready = 0;
    for (const action of ACTION_ORDER) {
      if (!block.actions.includes(action)) {
        continue;
      }
      const crew = byRole.get(ACTION_ROLE[action]) || [];
      if (crew.length === 0) {
        continue;
      }
      // Свободный раньше всех курсор нужной роли; первый вылет — без перелёта
      let chosen = null;
      let chosenStart = Infinity;
      for (const cursor of crew) {
        const free = freeAt.get(cursor.id);
        const start = Math.max(ready, free === null ? 0 : free + travel);
        if (start < chosenStart) {
          chosen = cursor;
          chosenStart = start;
        }
      }
      const duration = getActionDuration(action, block);
      steps.push({ cursor: chosen.id, action: action, element: block.id, start: chosenStart, duration: duration, order: blockIndex });
      freeAt.set(chosen.id, chosenStart + duration);
      ready = chosenStart + duration;
    }
  });

  let total = 0;
  for (const step of steps) {
    total = Math.max(total, step.start + step.duration);
  }
  // Не влезли в лимит — сжимаем всё расписание целиком: порядок и пропорции сохраняются
  const scale = total > limit ? limit / total : 1;
  const result = steps.map(function (step) {
    return { cursor: step.cursor, action: step.action, element: step.element, start: step.start * scale, duration: step.duration * scale, order: step.order };
  }).sort(function (first, second) {
    return first.start - second.start || first.order - second.order;
  }).map(function (step) {
    return { cursor: step.cursor, action: step.action, element: step.element, start: step.start, duration: step.duration };
  });
  return { steps: result, total: total * scale };
}
