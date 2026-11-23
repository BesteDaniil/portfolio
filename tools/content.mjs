/* ==========================================================
   npm run content — переписывает index.html из js/content.js.
   Меняется только то, что между метками <!-- content:… --> ; остальной index.html не трогается.
   Тест tests/content.test.js падает, если index.html отстал от content.js.
   ========================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { content } from "../js/content.js";
import { renderBody, renderMeta } from "../js/render.js";

export const INDEX_PATH = fileURLToPath(new URL("../index.html", import.meta.url));

function replaceBetween(html, name, inner) {
  const start = "<!-- content:" + name + " -->";
  const end = "<!-- /content:" + name + " -->";
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from < 0 || to < from) {
    throw new Error("В index.html нет меток " + start + " … " + end);
  }
  return html.slice(0, from + start.length) + "\n" + inner + "\n" + html.slice(to);
}

export function applyContent(html) {
  return replaceBetween(replaceBetween(html, "meta", renderMeta(content)), "body", renderBody(content));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = readFileSync(INDEX_PATH, "utf8");
  const next = applyContent(html);
  writeFileSync(INDEX_PATH, next);
  console.log(next === html ? "index.html уже совпадает с content.js" : "index.html обновлён из content.js");
}
