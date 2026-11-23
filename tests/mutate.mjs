/* ==========================================================
   Доказательство тестов поломкой: по очереди ломаем код в одном месте,
   запускаем тесты — они обязаны покраснеть, — и возвращаем код обратно.
   npm run mutate          — поломки чистых модулей, ловят юнит-тесты (node --test)
   npm run mutate -- --e2e — поломки интерфейса, ловят браузерные тесты (Playwright)
   ========================================================== */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MUTATIONS = [
  { name: "Хореография: действия блока не по порядку", file: "js/timeline.js", find: "export const ACTION_ORDER = [\"frame\", \"reveal\", \"text\", \"color\", \"image\", \"check\"];", replace: "export const ACTION_ORDER = [\"frame\", \"text\", \"reveal\", \"color\", \"image\", \"check\"];" },
  { name: "Хореография: следующее действие не ждёт предыдущее", file: "js/timeline.js", find: "      ready = chosenStart + duration;", replace: "" },
  { name: "Хореография: курсор делает два дела сразу", file: "js/timeline.js", find: "const start = Math.max(ready, free === null ? 0 : free + travel);", replace: "const start = ready;" },
  { name: "Хореография: не сжимается под лимит", file: "js/timeline.js", find: "const scale = total > limit ? limit / total : 1;", replace: "const scale = 1;" },
  { name: "Хореография: действие отдаётся чужой роли", file: "js/timeline.js", find: "const crew = byRole.get(ACTION_ROLE[action]) || [];", replace: "const crew = cursors;" },
  { name: "Хореография: шаги не по времени", file: "js/timeline.js", find: "return first.start - second.start || first.order - second.order;", replace: "return first.order - second.order;" },
  { name: "Курсоры: «тестов» два", file: "js/timeline.js", find: "18: { layout: 5, animation: 2, text: 5, color: 2, images: 3, tests: 1 },", replace: "18: { layout: 5, animation: 2, text: 5, color: 2, images: 2, tests: 2 }," },
  { name: "Курсоры: на телефоне 9", file: "js/timeline.js", find: "8: { layout: 2, animation: 1, text: 2, color: 1, images: 1, tests: 1 }", replace: "8: { layout: 3, animation: 1, text: 2, color: 1, images: 1, tests: 1 }" },
  { name: "Печать: длинный текст без предела", file: "js/timeline.js", find: "return Math.max(TEXT_MIN, Math.min(TEXT_MAX, 120 + chars * TEXT_PER_CHAR));", replace: "return Math.max(TEXT_MIN, 120 + chars * TEXT_PER_CHAR);" },
  { name: "Слово: точек на одну меньше", file: "js/shapes.js", find: "  for (let index = 0; index < count; index++) {\n    const spot", replace: "  for (let index = 0; index < count - 1; index++) {\n    const spot" },
  { name: "Слово: точки вылезают за клетку", file: "js/shapes.js", find: "spots.push({ x: cell.x + (column + 0.5) / k * cell.size,", replace: "spots.push({ x: cell.x + (column + 1.5) / k * cell.size," },
  { name: "Слово: точки только в начале слова", file: "js/shapes.js", find: "const spot = spots[Math.floor(index * spots.length / count)];", replace: "const spot = spots[index % spots.length];" },
  { name: "Слово: случайный разброс вместо сетки", file: "js/shapes.js", find: "    points.push({ x: spot.x, y: spot.y });", replace: "    points.push({ x: spot.x + (halton(index + 1, 3) - 0.5) * layout.size * 0.4, y: spot.y + (halton(index + 1, 5) - 0.5) * layout.size * 0.4 });" },
  { name: "Слово: сетка в клетке реже, чем можно", file: "js/shapes.js", find: "const k = Math.max(1, Math.floor(Math.sqrt(count / cells)));", replace: "const k = 1;" },
  { name: "Сердце: точки без проверки «внутри»", file: "js/shapes.js", find: "    if (isInsideHeart(point)) {\n      points.push(point);\n    }", replace: "    points.push(point);" },
  { name: "Сердце: формула перевёрнута", file: "js/shapes.js", find: "return base * base * base - x * x * y * y * y <= 0;", replace: "return base * base * base + x * x * y * y * y <= 0;" },
  { name: "Сопоставление: без сортировки", file: "js/shapes.js", find: "    mapping[fromOrder[rank]] = toOrder[rank];", replace: "    mapping[rank] = toOrder[rank];" },
  { name: "Сопоставление: повторы", file: "js/shapes.js", find: "    mapping[fromOrder[rank]] = toOrder[rank];", replace: "    mapping[fromOrder[rank]] = toOrder[0];" },
  { name: "Халтон: не то основание", file: "js/shapes.js", find: "    result += fraction * (value % base);", replace: "    result += fraction * (value % 2);" },
  { name: "Easing: выходит за 1", file: "js/easing.js", find: "  return t >= 1 ? 1 : t;", replace: "  return t;" },
  { name: "Easing: inOut без торможения", file: "js/easing.js", find: "return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;", replace: "return x;" },
  { name: "Easing: доля пути считается от конца", file: "js/easing.js", find: "return clamp01((now - start) / duration);", replace: "return clamp01((now - start) / (duration * 2));" },
  { name: "Контент: index.html отстал от content.js", file: "js/content.js", find: "role: \"Разрабатываю сайты и автоматизацию\",", replace: "role: \"Разрабатываю сайты\"," },
  { name: "Контент: ссылка на проект без новой вкладки", file: "js/render.js", find: "return \"href=\\\"\" + escapeHtml(url) + \"\\\" target=\\\"_blank\\\" rel=\\\"noopener\\\"\";", replace: "return \"href=\\\"\" + escapeHtml(url) + \"\\\"\";" },
  { name: "Контент: текст не экранируется", file: "js/render.js", find: "  return String(value).replace(/[&<>\"]/g, function (char) {", replace: "  return String(value).replace(/[\"]/g, function (char) {" }
];

/* Поломки интерфейса: ловят браузерные тесты */
const E2E_MUTATIONS = [
  { name: "UI: без JS контент спрятан", file: "index.html", find: "      root.classList.add(\"js\");", replace: "      root.classList.add(\"js\");\n      root.classList.add(\"assembling\");" },
  { name: "UI: «уменьшить движение» не учитывается", file: "index.html", find: "      if (!seen && !still) {", replace: "      if (!seen) {" },
  { name: "UI: рой при «уменьшить движение» анимируется", file: "js/app.js", find: "createSwarm(canvas, { still: stillQuery.matches })", replace: "createSwarm(canvas, { still: false })" },
  { name: "UI: клик не прерывает сборку", file: "js/assemble.js", find: "    if (event.pointerType === \"mouse\" && event.clientX < document.documentElement.clientWidth) {\n      interrupt();", replace: "    if (event.pointerType === \"mouse\" && event.clientX < document.documentElement.clientWidth) {\n      void 0;" },
  { name: "UI: прокрутка прерывает сборку", file: "js/assemble.js", find: "  window.addEventListener(\"keydown\", function (event) {", replace: "  window.addEventListener(\"wheel\", interrupt, { passive: true });\n  window.addEventListener(\"scroll\", interrupt, { passive: true });\n  window.addEventListener(\"keydown\", function (event) {" },
  { name: "UI: клавиша не прерывает сборку", file: "js/assemble.js", find: "      return;\n    }\n    interrupt();\n  });", replace: "      return;\n    }\n  });" },
  { name: "UI: печать не возвращает текст как был", file: "js/assemble.js", find: "    part.node.data = part.full;\n    part.hidden.remove();", replace: "    part.node.data = part.full.trim();\n    part.hidden.remove();" },
  { name: "UI: после сборки остаются классы состояния", file: "js/assemble.js", find: "      element.classList.remove(...STATE_CLASSES);", replace: "" },
  { name: "UI: R не перезапускает", file: "js/app.js", find: "  if (event.code === \"KeyR\") {\n    assembly.start(false);", replace: "  if (event.code === \"KeyR\") {\n    void 0;" },
  { name: "UI: S не замедляет", file: "js/assemble.js", find: "const SLOW_RATE = 1 / 3;", replace: "const SLOW_RATE = 1;" },
  { name: "UI: рой не встаёт на паузу вне экрана", file: "js/swarm.js", find: "    visible = entries[entries.length - 1].isIntersecting;", replace: "    visible = true;" },
  { name: "UI: на телефоне рой как на ПК", file: "js/swarm.js", find: "return width < 700 ? 150 : 420;", replace: "return 420;" },
  { name: "UI: на телефоне 18 курсоров сборки", file: "js/app.js", find: "  return mobileQuery.matches;", replace: "  return false;" },
  { name: "UI: первый экран дольше 5 секунд", file: "js/assemble.js", find: "    clock += dt * rate;", replace: "    clock += dt * rate * 0.4;" },
  { name: "UI: повторный визит снова с анимацией", file: "index.html", find: "seen = window.sessionStorage.getItem(\"portfolio:assembled\") === \"1\";", replace: "seen = false;" },
  { name: "UI: шрифт с Google Fonts", file: "index.html", find: "  <link rel=\"stylesheet\" href=\"css/style.css?v=10\">", replace: "  <link rel=\"stylesheet\" href=\"css/style.css?v=10\">\n  <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Inter\">" },
  { name: "UI: ошибка в консоли", file: "js/app.js", find: "// Для проверок (Playwright): состояние сборки и роя", replace: "console.error(\"сломано\");\n// Для проверок (Playwright): состояние сборки и роя" },
  { name: "UI: картинки остаются скрытыми после сборки", file: "css/style.css", find: ".assembling [data-build~=\"image\"]:not(.b-image) :is(img, svg) {", replace: "[data-build~=\"image\"]:not(.b-image) :is(img, svg) {" },
  { name: "UI: горизонтальный скролл", file: "css/style.css", find: ".crew {\n  position: fixed;", replace: ".crew {\n  min-width: 2000px;\n  position: absolute;" }
];

const E2E = process.argv.includes("--e2e");

function runUnit() {
  const files = readdirSync(path.join(root, "tests")).filter(function (name) {
    return name.endsWith(".test.js");
  }).map(function (name) {
    return "tests/" + name;
  });
  const result = spawnSync(process.execPath, ["--test"].concat(files), { cwd: root, encoding: "utf8" });
  const output = result.stdout + result.stderr;
  const pass = Number((output.match(/^ℹ pass (\d+)/m) || [])[1] || 0);
  const fail = Number((output.match(/^ℹ fail (\d+)/m) || [])[1] || 0);
  const failed = [];
  for (const match of output.matchAll(/^✖ (.+?) \([\d.]+ms\)$/gm)) {
    if (!failed.includes(match[1])) {
      failed.push(match[1]);
    }
  }
  return { pass: pass, fail: fail, failed: failed, crashed: result.status !== 0 && fail === 0 };
}

function runE2e() {
  const cli = path.join(root, "node_modules", "@playwright", "test", "cli.js");
  const result = spawnSync(process.execPath, [cli, "test", "--reporter=line"], { cwd: root, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  const output = result.stdout + result.stderr;
  const pass = Number((output.match(/(\d+) passed/) || [])[1] || 0);
  const fail = Number((output.match(/(\d+) failed/) || [])[1] || 0);
  const failed = [];
  for (const match of output.matchAll(/› (.+?) ─*$/gm)) {
    if (!failed.includes(match[1].trim())) {
      failed.push(match[1].trim());
    }
  }
  return { pass: pass, fail: fail, failed: failed, crashed: result.status !== 0 && fail === 0 };
}

const runTests = E2E ? runE2e : runUnit;

let pending = null;
function restorePending() {
  if (pending) {
    writeFileSync(pending.path, pending.original);
    pending = null;
  }
}
process.on("SIGINT", function () {
  restorePending();
  process.exit(130);
});
process.on("SIGTERM", function () {
  restorePending();
  process.exit(143);
});

const baseline = runTests();
console.log("Исходный код: pass=" + baseline.pass + " fail=" + baseline.fail);
if (baseline.fail > 0 || baseline.crashed) {
  console.error("Тесты красные ещё до поломок — сначала почините их.");
  process.exit(1);
}

const LIST = E2E ? E2E_MUTATIONS : MUTATIONS;
let survived = 0;
for (const mutation of LIST) {
  const filePath = path.join(root, mutation.file);
  const original = readFileSync(filePath, "utf8");
  const source = original.replace(/\r\n/g, "\n");
  if (!source.includes(mutation.find)) {
    console.error("✖ " + mutation.name + " — место для поломки не найдено в " + mutation.file);
    survived++;
    continue;
  }
  let result;
  try {
    pending = { path: filePath, original: original };
    writeFileSync(filePath, source.replace(mutation.find, mutation.replace));
    result = runTests();
  } finally {
    writeFileSync(filePath, original);
    pending = null;
  }
  const caught = result.fail > 0 || result.crashed;
  if (!caught) {
    survived++;
  }
  console.log((caught ? "✔ поймано" : "✖ НЕ ПОЙМАНО") + " — " + mutation.name + ": pass=" + result.pass + " fail=" + result.fail);
  for (const name of result.failed.slice(0, 3)) {
    console.log("    красный: " + name);
  }
}

const after = runTests();
console.log("Код возвращён: pass=" + after.pass + " fail=" + after.fail);
console.log((E2E ? "Браузерных поломок: " : "Поломок: ") + LIST.length + ", поймано: " + (LIST.length - survived) + ", не поймано: " + survived);
process.exit(survived > 0 || after.fail > 0 ? 1 : 0);
