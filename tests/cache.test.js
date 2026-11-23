import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");

test("кэш: у app.js, style.css и каждого модуля из importmap один и тот же ?v", function () {
  const app = html.match(/src="js\/app\.js\?v=(\d+)"/);
  const css = html.match(/href="css\/style\.css\?v=(\d+)"/);
  assert.ok(app && css, "нет ?v у app.js или style.css");
  assert.equal(css[1], app[1]);
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  // Модули, которые грузит браузер (content.js и render.js нужны только инструменту npm run content)
  const modules = readdirSync(new URL("js/", root)).filter(function (name) {
    return name.endsWith(".js") && !["app.js", "content.js", "render.js"].includes(name);
  });
  assert.ok(modules.length >= 6);
  for (const name of modules) {
    assert.equal(map["./js/" + name], "./js/" + name + "?v=" + app[1], name);
  }
});
