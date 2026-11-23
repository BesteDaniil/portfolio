// Портфолио «собирают курсоры»: проверки из ТЗ в настоящем Chrome.
// Запуск: npm run e2e. Доказательство поломкой: npm run mutate -- --e2e
import { test, expect } from "@playwright/test";

const WIDTHS = [320, 375, 768, 1280, 1440];

function watch(page) {
  const problems = [];
  const requests = [];
  page.on("console", function (message) {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });
  page.on("pageerror", function (error) {
    problems.push(String(error));
  });
  page.on("request", function (request) {
    requests.push(request.url());
  });
  return { problems: problems, requests: requests };
}

function mode(page) {
  return page.evaluate(function () {
    return document.documentElement.dataset.assembly || "";
  });
}

/* Прокрутка мгновенная. Плавная (scroll-behavior: smooth) меняет то, как Chrome растрирует
   картинки с loading="lazy": они остаются уменьшенными «грубо» и без всякой сборки — проверено */
function jumpTo(page, top) {
  return page.evaluate(function (value) {
    window.scrollTo({ top: value, behavior: "instant" });
  }, top);
}

/* Дать сборке пройти целиком естественным путём: первый экран, потом каждая секция при прокрутке */
async function assembleNaturally(page) {
  await expect.poll(function () { return mode(page); }, { timeout: 15000 }).toMatch(/waiting|done/);
  const sections = await page.locator("[data-section]").count();
  for (let index = 1; index < sections; index++) {
    await page.evaluate(function (position) {
      document.querySelectorAll("[data-section]")[position].scrollIntoView({ block: "start", behavior: "instant" });
    }, index);
    await expect.poll(function () {
      return page.evaluate(function (position) {
        const section = document.querySelectorAll("[data-section]")[position];
        return document.documentElement.dataset.assembly === "done" || section.dataset.built === "1";
      }, index);
    }, { timeout: 15000 }).toBe(true);
  }
  await expect.poll(function () { return mode(page); }, { timeout: 15000 }).toBe("done");
}

test("1. JavaScript выключен — весь контент виден", async function ({ browser }) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("./");
  for (const text of ["Daniil", "Разрабатываю сайты и автоматизацию", "Что я сделал", "Мультиагентный хаб", "Чем работаю", "Сайт компании", "Частые вопросы", "Есть задача?"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  const hidden = await page.locator("[data-build], [data-build] img, [data-build] svg").evaluateAll(function (items) {
    return items.filter(function (item) {
      const style = window.getComputedStyle(item);
      return style.opacity !== "1" || style.filter !== "none" || style.visibility !== "visible";
    }).length;
  });
  expect(hidden).toBe(0);
  await context.close();
});

test("2. prefers-reduced-motion — контент сразу, кадры роя не меняются", async function ({ browser }) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("./");
  await expect(page.locator("html")).not.toHaveClass(/assembling/);
  await expect(page.locator(".cursor")).toHaveCount(0);
  await page.locator("#swarmCanvas").scrollIntoViewIfNeeded();
  const first = await page.evaluate(function () { return window.__portfolio.swarm.frames; });
  await page.waitForTimeout(1200);
  const second = await page.evaluate(function () { return window.__portfolio.swarm.frames; });
  expect(first).toBe(1);
  expect(second).toBe(first);
  await context.close();
});

test("3. клик во время анимации — готовая страница меньше чем за 300 мс", async function ({ page }) {
  await page.goto("./");
  await expect.poll(function () { return page.locator(".cursor:not(.is-hidden)").count(); }).toBeGreaterThan(0);
  // Замер ставится ДО клика (иначе клик может опередить слушатель)
  await page.evaluate(function () {
    window.__clickDelay = new Promise(function (resolve) {
      let start = 0;
      window.addEventListener("pointerdown", function () {
        start = performance.now();
      }, { capture: true, once: true });
      const observer = new MutationObserver(function () {
        if (start && !document.documentElement.classList.contains("assembling")) {
          observer.disconnect();
          resolve(performance.now() - start);
        }
      });
      observer.observe(document.documentElement, { attributes: true });
    });
  });
  await expect(page.locator("html")).toHaveClass(/assembling/);
  await page.mouse.click(4, 500);
  expect(await page.evaluate(function () { return window.__clickDelay; })).toBeLessThan(300);
  await expect(page.locator(".crew > *")).toHaveCount(0);
  await expect(page.locator(".ghost")).toHaveCount(0);
});

test("3б. прокрутка во время сборки её не прерывает, а любая клавиша — пропускает", async function ({ page }) {
  await page.goto("./");
  await expect.poll(function () { return page.locator(".cursor:not(.is-hidden)").count(); }).toBeGreaterThan(0);
  // Листаем колесом вниз и обратно, пока собирается первый экран
  await page.mouse.move(640, 400);
  for (let step = 0; step < 4; step++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(80);
  }
  await page.mouse.wheel(0, -1600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(function () { return window.scrollY; })).toBeLessThan(5);
  await expect(page.locator("html")).toHaveClass(/assembling/);
  expect(await mode(page)).toMatch(/running|waiting/);
  // Клавиша — готовая страница
  await page.keyboard.press("Space");
  await expect.poll(function () { return mode(page); }, { timeout: 1000 }).toBe("done");
  await expect(page.locator("html")).not.toHaveClass(/assembling/);
  await expect(page.locator(".crew > *")).toHaveCount(0);
});

test("4. после анимации страница пиксель в пиксель как без анимации", async function ({ browser }) {
  // Сравнение экран за экраном — как видит человек (снимок fullPage в Chrome теряет липкую шапку).
  // Статичная и собранная страницы снимаются по очереди, как два разных посетителя.
  // Битмапы фото-превью (img) закрыты маской: как Chrome уменьшает фото 1200 px до 568 px
  // («гладко» или «грубо»), зависит от пути и момента прокрутки — так бывает и без сборки
  // (проверено: плавная прокрутка статичной страницы даёт ту же разницу). Вместо пикселей фото
  // ниже сравниваются их стили и стили предков — любой след сборки на картинке там виден.
  test.setTimeout(120000);
  const options = { animations: "disabled", caret: "hide" };
  const viewport = { width: 1280, height: 860 };

  async function shootScreens(page) {
    await page.mouse.move(0, 0);
    const height = await page.evaluate(function () { return document.documentElement.scrollHeight; });
    const shots = [];
    for (let top = 0; top < height; top += 700) {
      await jumpTo(page, top);
      await page.waitForTimeout(150);
      shots.push({ top: top, image: await page.screenshot({ ...options, mask: [page.locator("#swarmCanvas"), page.locator(".project__img")] }) });
    }
    const imageStyles = await page.locator(".project__img").evaluateAll(function (images) {
      return images.map(function (image) {
        const chain = [];
        for (let node = image; node && node !== document.body; node = node.parentElement) {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          chain.push([node.tagName, node.getAttribute("class"), node.getAttribute("style"), style.opacity, style.filter, style.transform, style.visibility, style.clipPath, style.mixBlendMode, Math.round(rect.width), Math.round(rect.height)].join("|"));
        }
        return image.currentSrc + " " + image.complete + " " + chain.join(" > ");
      });
    });
    return { height: height, shots: shots, imageStyles: imageStyles };
  }

  const still = await browser.newContext({ reducedMotion: "reduce", viewport: viewport });
  const stillPage = await still.newPage();
  await stillPage.goto("./");
  await stillPage.evaluate(function () { return document.fonts.ready; });
  const expected = await shootScreens(stillPage);
  await still.close();

  const moving = await browser.newContext({ viewport: viewport });
  const page = await moving.newPage();
  await page.goto("./");
  await assembleNaturally(page);
  const actual = await shootScreens(page);
  await moving.close();

  expect(actual.height).toBe(expected.height);
  const differs = actual.shots.filter(function (shot, index) {
    return !shot.image.equals(expected.shots[index].image);
  }).map(function (shot) {
    return shot.top;
  });
  expect(differs, "экраны отличаются на прокрутке").toEqual([]);
  expect(actual.imageStyles.length).toBeGreaterThan(0);
  // И сами по себе фото видны: без прозрачности и фильтров (одинаково сломанные обе версии не пройдут)
  for (const chain of actual.imageStyles) {
    expect(chain, "фото-превью скрыто или размыто").toMatch(/ true IMG\|[^|]*\|[^|]*\|1\|none\|none\|visible\|/);
  }
  expect(actual.imageStyles, "у фото-превью остался след сборки").toEqual(expected.imageStyles);
});

test("5. R перезапускает сборку, S — медленно", async function ({ page }) {
  await page.goto("./");
  await page.keyboard.press("Escape");
  await expect.poll(function () { return mode(page); }).toBe("done");
  await page.keyboard.press("r");
  await expect(page.locator("html")).toHaveClass(/assembling/);
  const started = Date.now();
  await expect.poll(function () { return mode(page); }, { timeout: 10000 }).toBe("waiting");
  const normal = Date.now() - started;
  expect(await page.evaluate(function () { return window.__portfolio.assembly.getRate(); })).toBe(1);

  await page.keyboard.press("s");
  expect(await page.evaluate(function () { return window.__portfolio.assembly.getRate(); })).toBeCloseTo(1 / 3);
  await page.waitForTimeout(normal + 500);
  // Обычная сборка первого экрана уже кончилась бы — медленная ещё идёт
  expect(await mode(page)).toBe("running");
});

test("6. все ссылки на проекты отвечают 200", async function ({ page, request }) {
  await page.goto("./");
  const urls = await page.locator("a[target=_blank]").evaluateAll(function (links) {
    return Array.from(new Set(links.map(function (link) { return link.href; }))).filter(function (href) {
      return !href.startsWith("https://t.me/");
    });
  });
  expect(urls).toEqual(expect.arrayContaining([
    "https://look-star.ru/",
    "https://bestedaniil.github.io/steel-gloss/",
    "https://bestedaniil.github.io/autograd/"
  ]));
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
  }
});

for (const width of WIDTHS) {
  test("7. " + width + " px — без горизонтального скролла (и во время сборки)", async function ({ browser }) {
    for (const reducedMotion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({ viewport: { width: width, height: 800 }, reducedMotion: reducedMotion });
      const page = await context.newPage();
      await page.goto("./");
      await page.waitForTimeout(reducedMotion === "reduce" ? 300 : 1500);
      const overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth - window.innerWidth;
      });
      expect(overflow, reducedMotion).toBeLessThanOrEqual(0);
      await context.close();
    }
  });
}

test("8. рой вне экрана — на паузе: счётчик кадров не растёт", async function ({ page }) {
  await page.goto("./");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const first = await page.evaluate(function () { return window.__portfolio.swarm.frames; });
  await page.waitForTimeout(1200);
  const second = await page.evaluate(function () { return window.__portfolio.swarm.frames; });
  expect(second).toBe(first);
  await page.locator("#swarmCanvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const visible = await page.evaluate(function () { return window.__portfolio.swarm.frames; });
  expect(visible).toBeGreaterThan(second + 10);
  // Ушли со страницы — снова пауза
  await page.evaluate(function () { window.scrollTo(0, 0); });
  await page.waitForTimeout(300);
  const away = await page.evaluate(function () { return window.__portfolio.swarm.frames; });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(function () { return window.__portfolio.swarm.frames; })).toBe(away);
});

test("9. на 375 px в рое не больше 180 курсоров, сборку ведут 8 курсоров", async function ({ browser }) {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await page.goto("./");
  await expect.poll(function () { return page.locator(".cursor").count(); }).toBe(8);
  const count = await page.evaluate(function () { return window.__portfolio.swarm.count; });
  expect(count).toBeGreaterThanOrEqual(120);
  expect(count).toBeLessThanOrEqual(180);
  await expect(page.locator("#buildCaption")).toHaveText("Страницу собрали 8 курсоров. R — ещё раз, S — медленно");
  await context.close();
});

test("9б. на ПК рой 300–500 курсоров, сборку ведут 18; первый экран — не дольше 5 с", async function ({ page }) {
  await page.goto("./");
  await expect.poll(function () { return page.locator(".cursor").count(); }).toBe(18);
  const count = await page.evaluate(function () { return window.__portfolio.swarm.count; });
  expect(count).toBeGreaterThanOrEqual(300);
  expect(count).toBeLessThanOrEqual(500);
  await expect.poll(function () { return mode(page); }, { timeout: 10000 }).toBe("waiting");
  const firstScreen = await page.evaluate(function () { return window.__portfolio.assembly.getStats().firstScreenMs; });
  expect(firstScreen).toBeLessThanOrEqual(5000);
});

test("10 и 11. ни одного запроса к чужим доменам, консоль без ошибок — за всю сборку", async function ({ page, baseURL }) {
  const seen = watch(page);
  await page.goto("./");
  await assembleNaturally(page);
  await page.locator("#swarmCanvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const own = new URL(baseURL).host;
  const foreign = seen.requests.filter(function (url) {
    const parsed = new URL(url);
    return parsed.protocol.startsWith("http") && parsed.host !== own;
  });
  expect(foreign).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test("12. меню на телефоне: клавиатура, aria-expanded, Esc, клик мимо, пункт", async function ({ browser }) {
  // Без JS кнопки нет (она ничего бы не делала), меню закрыто
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  const plain = await noJs.newPage();
  await plain.goto("./");
  await expect(plain.locator("#menuButton")).toBeHidden();
  await expect(plain.locator("#mobileMenu")).toBeHidden();
  await noJs.close();

  const context = await browser.newContext({ viewport: { width: 375, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("./");
  const button = page.locator("#menuButton");
  const menu = page.locator("#mobileMenu");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-controls", "mobileMenu");
  await expect(button).toHaveAccessibleName("Меню");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  // До кнопки можно дойти Tab-ом
  let reached = false;
  for (let step = 0; step < 6 && !reached; step++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(function () { return document.activeElement && document.activeElement.id === "menuButton"; });
  }
  expect(reached, "Tab не доходит до кнопки меню").toBe(true);

  // Enter открывает; пункты — Работы, Цены, Контакты; Tab идёт в меню
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toBeVisible();
  await expect(menu.locator("a")).toHaveText(["Работы", "Цены", "Контакты"]);
  expect(await menu.locator("a").evaluateAll(function (links) {
    return links.map(function (link) { return link.getAttribute("href"); });
  })).toEqual(["#work", "#prices", "#contact"]);
  await page.keyboard.press("Tab");
  await expect(menu.locator("a").first()).toBeFocused();

  // Esc закрывает и возвращает фокус на кнопку
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();

  // Пробел открывает, клик мимо закрывает
  await page.keyboard.press("Space");
  await expect(menu).toBeVisible();
  // Мимо — по картинке, которая не берёт фокус (иначе меню закрыл бы уход фокуса, а не клик)
  await page.locator(".hero__art").click({ position: { x: 20, y: 20 } });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  // Пункт меню: закрывает меню и ведёт к разделу
  await button.click();
  await menu.getByText("Цены", { exact: true }).click();
  await expect(menu).toBeHidden();
  await expect.poll(function () {
    return page.evaluate(function () { return Math.round(document.getElementById("prices").getBoundingClientRect().top); });
  }).toBeLessThan(100);

  // Tab за последний пункт — меню закрывается; Shift+Tab с кнопки назад — тоже
  await page.evaluate(function () { window.scrollTo({ top: 0, behavior: "instant" }); });
  await button.click();
  await menu.locator("a").last().focus();
  await page.keyboard.press("Tab");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(button).toHaveAttribute("aria-expanded", "false");

  // На ПК кнопки нет — обычные пункты в шапке; открытое меню закрывается при переходе на широкий экран
  await button.click();
  await expect(menu).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeHidden();
  await expect(page.locator(".nav")).toBeVisible();
  await context.close();
});

test("повторный визит в той же вкладке — без анимации; клавиатура и фокус видны", async function ({ page }) {
  await page.goto("./");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/assembling/);
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(function () {
    const style = window.getComputedStyle(document.activeElement);
    return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  });
  expect(outline).toBe(true);
});
