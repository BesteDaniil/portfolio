import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDEX_PATH, applyContent } from "../tools/content.mjs";
import { content } from "../js/content.js";
import { renderBody, escapeHtml } from "../js/render.js";

const html = readFileSync(INDEX_PATH, "utf8");

test("контент: index.html совпадает с js/content.js (иначе — npm run content)", function () {
  assert.equal(applyContent(html), html);
});

test("контент: заглушек нет, все проекты и цены на месте", function () {
  const text = JSON.stringify(content);
  assert.doesNotMatch(text, /ЗАПОЛНИ|TODO|lorem/i);
  const titles = content.work.projects.map(function (project) { return project.title; });
  assert.deepEqual(titles, ["Look Star", "STEEL & GLOSS", "«АВТОГРАД» — Центр заявок для автосалона", "Мультиагентный хаб"]);
  assert.equal(content.prices.cards.length, 3);
  assert.deepEqual(content.prices.cards.map(function (card) { return card.price; }), ["10 000 ₽", "40 000 ₽", "50 000 ₽"]);
});

test("контент: «Дополнительно» — цены из прежнего портфолио без изменений, есть в HTML", function () {
  const extras = content.prices.extras.items.map(function (item) {
    return [item.title, item.price, item.per];
  });
  assert.deepEqual(extras, [
    ["Новый раздел", "10–15 тыс. ₽", ""],
    ["Подключение домена", "3–5 тыс. ₽", ""],
    ["Поддержка", "3–5 тыс. ₽", "/ мес"]
  ]);
  assert.ok(html.includes("<h3 class=\"extras__title\">Дополнительно</h3>"));
  assert.ok(html.includes(escapeHtml("3–5 тыс. ₽") + " <small>/ мес</small>"));
});

test("контент: меню телефона — Работы, Цены, Контакты, и каждый якорь есть на странице", function () {
  assert.deepEqual(content.mobileNav.map(function (item) { return item.label; }), ["Работы", "Цены", "Контакты"]);
  for (const item of content.mobileNav) {
    assert.ok(html.includes("id=\"" + item.href.slice(1) + "\""), item.href);
  }
  assert.match(html, /<button class="menu-btn"[^>]*aria-expanded="false"[^>]*aria-controls="mobileMenu"[^>]*hidden/);
});

test("контент: ссылки на проекты — в новой вкладке; у хаба ссылки нет", function () {
  const body = renderBody(content);
  for (const project of content.work.projects) {
    if (project.url) {
      assert.ok(body.includes("href=\"" + project.url + "\" target=\"_blank\" rel=\"noopener\""), project.id);
    }
  }
  assert.equal(content.work.projects[3].url, "");
});

test("контент: весь текст попадает в HTML без JavaScript", function () {
  for (const value of [content.hero.name, content.hero.role, content.hero.lead, content.contact.title, content.faq.items[4].a]) {
    assert.ok(html.includes(escapeHtml(value)), value);
  }
  assert.ok(html.includes("Страницу собрали 18 курсоров. R — ещё раз, S — медленно"));
});

test("контент: разметка экранируется", function () {
  assert.equal(escapeHtml("<b>\"A&B\"</b>"), "&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
});

test("контент: ни одного внешнего ресурса, кроме ссылок", function () {
  const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
  assert.doesNotMatch(html + css, /fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr/);
  // В src/href ресурсов (скрипты, стили, картинки, шрифты) — только свои файлы
  for (const match of html.matchAll(/<(?:script|img|link)[^>]+(?:src|href)="([^"]+)"/g)) {
    if (/rel="canonical"/.test(match[0])) {
      continue;
    }
    assert.ok(!/^https?:/.test(match[1]), match[1]);
  }
  assert.doesNotMatch(css, /url\(\s*["']?https?:/);
});
