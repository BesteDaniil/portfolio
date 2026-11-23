/* ==========================================================
   content.js → разметка страницы. Чистая функция без DOM: её вызывает
   tools/content.mjs и пишет результат в index.html. Поэтому весь контент
   лежит в HTML сразу — страница полная и без JavaScript, и для поисковиков.

   data-build="frame text color image check" — что курсоры делают с блоком
   при сборке (см. js/timeline.js); data-section — секция, собирается при прокрутке.
   ========================================================== */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, function (char) {
    return ESCAPES[char];
  });
}

function build(actions) {
  return " data-build=\"" + actions + "\"";
}

function external(url) {
  return "href=\"" + escapeHtml(url) + "\" target=\"_blank\" rel=\"noopener\"";
}

const ICON_TELEGRAM = "<svg class=\"icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m22 2-7 20-4-9-9-4Z\"/><path d=\"M22 2 11 13\"/></svg>";
const ICON_MENU = "<svg class=\"icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path class=\"menu-btn__open\" d=\"M4 7h16M4 12h16M4 17h16\"/><path class=\"menu-btn__close\" d=\"M6 6l12 12M18 6 6 18\"/></svg>";
const ICON_ARROW = "<svg class=\"icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 17 17 7\"/><path d=\"M8 7h9v9\"/></svg>";

/* Иллюстрация вместо фото: окно браузера, которое собирают курсоры */
const HERO_ART = [
  "<svg class=\"hero__art-svg\" viewBox=\"0 0 320 240\" role=\"img\" aria-label=\"Окно браузера, которое собирают курсоры\">",
  "<rect class=\"art-window\" x=\"10\" y=\"14\" width=\"300\" height=\"212\" rx=\"14\"/>",
  "<rect class=\"art-bar\" x=\"10\" y=\"14\" width=\"300\" height=\"30\" rx=\"14\"/>",
  "<circle class=\"art-dot\" cx=\"30\" cy=\"29\" r=\"4\"/><circle class=\"art-dot\" cx=\"44\" cy=\"29\" r=\"4\"/><circle class=\"art-dot\" cx=\"58\" cy=\"29\" r=\"4\"/>",
  "<rect class=\"art-block art-block--accent\" x=\"30\" y=\"62\" width=\"150\" height=\"16\" rx=\"5\"/>",
  "<rect class=\"art-block\" x=\"30\" y=\"88\" width=\"220\" height=\"9\" rx=\"4\"/>",
  "<rect class=\"art-block\" x=\"30\" y=\"104\" width=\"190\" height=\"9\" rx=\"4\"/>",
  "<rect class=\"art-frame\" x=\"30\" y=\"128\" width=\"118\" height=\"76\" rx=\"8\"/>",
  "<rect class=\"art-frame\" x=\"162\" y=\"128\" width=\"118\" height=\"76\" rx=\"8\"/>",
  "<path class=\"art-check\" d=\"m250 142 7 7 13-15\"/>",
  "<path class=\"art-cursor art-cursor--a\" d=\"M196 70v26l7-6 5 11 5-2-5-11h9Z\"/>",
  "<path class=\"art-cursor art-cursor--b\" d=\"M112 150v26l7-6 5 11 5-2-5-11h9Z\"/>",
  "<path class=\"art-cursor art-cursor--c\" d=\"M262 176v26l7-6 5 11 5-2-5-11h9Z\"/>",
  "</svg>"
].join("");

/* Превью хаба: граф агентов вокруг задачи */
const HUB_ART = [
  "<svg class=\"project__art\" viewBox=\"0 0 400 250\" role=\"img\" aria-label=\"Схема: задача в центре, вокруг — агенты разведчик, исполнитель, тестировщик и ревьюер\">",
  "<path class=\"hub-link\" d=\"M200 125 90 60M200 125l110-65M200 125 90 190M200 125l110 65\"/>",
  "<rect class=\"hub-core\" x=\"150\" y=\"100\" width=\"100\" height=\"50\" rx=\"12\"/>",
  "<text class=\"hub-text hub-text--core\" x=\"200\" y=\"131\">задача</text>",
  "<rect class=\"hub-node\" x=\"30\" y=\"38\" width=\"120\" height=\"44\" rx=\"10\"/><text class=\"hub-text\" x=\"90\" y=\"65\">разведчик</text>",
  "<rect class=\"hub-node\" x=\"250\" y=\"38\" width=\"120\" height=\"44\" rx=\"10\"/><text class=\"hub-text\" x=\"310\" y=\"65\">исполнитель</text>",
  "<rect class=\"hub-node\" x=\"30\" y=\"168\" width=\"120\" height=\"44\" rx=\"10\"/><text class=\"hub-text\" x=\"90\" y=\"195\">тестировщик</text>",
  "<rect class=\"hub-node\" x=\"250\" y=\"168\" width=\"120\" height=\"44\" rx=\"10\"/><text class=\"hub-text\" x=\"310\" y=\"195\">ревьюер</text>",
  "</svg>"
].join("");

function renderHeader(content) {
  const links = content.nav.map(function (item) {
    return "<a class=\"nav__link\" href=\"" + escapeHtml(item.href) + "\">" + escapeHtml(item.label) + "</a>";
  }).join("");
  const mobileLinks = content.mobileNav.map(function (item) {
    return "<a class=\"mmenu__link\" href=\"" + escapeHtml(item.href) + "\">" + escapeHtml(item.label) + "</a>";
  }).join("");
  return [
    "<header class=\"top\">",
    "<div class=\"container top__inner\">",
    "<a class=\"logo\" href=\"#top\"" + build("frame text") + "><span class=\"logo__mark\" aria-hidden=\"true\">D</span>" + escapeHtml(content.hero.name) + "</a>",
    "<nav class=\"nav\" aria-label=\"Разделы\"" + build("frame text") + ">" + links + "</nav>",
    "<a class=\"btn btn--small btn--ghost top__tg\" " + external(content.telegram.url) + build("frame text color") + ">" + ICON_TELEGRAM + "<span>Telegram</span></a>",
    // Меню на телефоне: без JS кнопка скрыта (hidden), js/menu.js её показывает
    "<button class=\"menu-btn\" type=\"button\" id=\"menuButton\" aria-expanded=\"false\" aria-controls=\"mobileMenu\" aria-label=\"Меню\" hidden" + build("frame color") + ">" + ICON_MENU + "</button>",
    "<nav class=\"mmenu\" id=\"mobileMenu\" aria-label=\"Разделы сайта\" hidden>" + mobileLinks + "</nav>",
    "</div>",
    "</header>"
  ].join("\n");
}

function renderHero(content) {
  const hero = content.hero;
  const stats = content.stats.map(function (stat) {
    return "<li class=\"stat\"" + build("frame text color check") + "><b class=\"stat__value\">" + escapeHtml(stat.value) + "</b><span class=\"stat__label\">" + escapeHtml(stat.label) + "</span></li>";
  }).join("");
  return [
    "<section class=\"hero\" id=\"top\" data-section=\"hero\" aria-labelledby=\"heroTitle\">",
    "<div class=\"container hero__grid\">",
    "<div class=\"hero__text\">",
    "<h1 class=\"hero__title\" id=\"heroTitle\"" + build("frame text check") + ">" + escapeHtml(hero.name) + "</h1>",
    "<p class=\"hero__role\"" + build("frame text color check") + ">" + escapeHtml(hero.role) + "</p>",
    "<p class=\"hero__lead\"" + build("frame text check") + ">" + escapeHtml(hero.lead) + "</p>",
    "<div class=\"hero__actions\">",
    "<a class=\"btn btn--accent\" href=\"" + escapeHtml(hero.primary.href) + "\"" + build("frame text color check") + ">" + escapeHtml(hero.primary.label) + "</a>",
    "<a class=\"btn btn--ghost\" " + external(content.telegram.url) + build("frame text color check") + ">" + ICON_TELEGRAM + "<span>" + escapeHtml(hero.secondary.label) + "</span></a>",
    "</div>",
    "</div>",
    "<div class=\"hero__art\"" + build("frame image check") + ">" + HERO_ART + "</div>",
    "</div>",
    "<div class=\"container\"><ul class=\"stats\" aria-label=\"Цифры\">" + stats + "</ul></div>",
    "</section>"
  ].join("\n");
}

function renderHead(section, id) {
  return [
    "<header class=\"section__head\">",
    "<p class=\"eyebrow\"" + build("frame text color") + ">" + escapeHtml(section.eyebrow) + "</p>",
    "<h2 class=\"section__title\" id=\"" + id + "Title\"" + build("frame text check") + ">" + escapeHtml(section.title) + "</h2>",
    section.lead ? "<p class=\"section__lead\"" + build("frame text") + ">" + escapeHtml(section.lead) + "</p>" : "",
    "</header>"
  ].filter(Boolean).join("\n");
}

function renderProject(project) {
  const tags = project.tags.map(function (tag) {
    return "<li class=\"tag\">" + escapeHtml(tag) + "</li>";
  }).join("");
  const preview = project.image
    ? "<img class=\"project__img\" src=\"" + escapeHtml(project.image) + "\" alt=\"" + escapeHtml(project.imageAlt) + "\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\">"
    : HUB_ART;
  const link = project.url
    ? "<a class=\"project__link\" " + external(project.url) + ">" + escapeHtml(project.linkLabel) + ICON_ARROW + "</a>"
    : "<p class=\"project__note\">Внутренний инструмент — без публичной ссылки</p>";
  return [
    "<article class=\"project\" id=\"project-" + escapeHtml(project.id) + "\"" + build("frame reveal check") + ">",
    "<div class=\"project__preview\"" + build("image") + ">" + preview + "</div>",
    "<div class=\"project__body\">",
    "<p class=\"project__kind\"" + build("text color") + ">" + escapeHtml(project.kind) + "</p>",
    "<h3 class=\"project__title\"" + build("text") + ">" + escapeHtml(project.title) + "</h3>",
    "<p class=\"project__text\"" + build("text") + ">" + escapeHtml(project.text) + "</p>",
    "<ul class=\"tags\" aria-label=\"Теги\"" + build("color") + ">" + tags + "</ul>",
    link,
    "</div>",
    "</article>"
  ].join("\n");
}

function renderWork(content) {
  const work = content.work;
  const more = work.more.links.map(function (item) {
    return "<a " + external(item.url) + ">" + escapeHtml(item.label) + "</a>";
  }).join(", ");
  return [
    "<section class=\"section\" id=\"work\" data-section=\"work\" aria-labelledby=\"workTitle\">",
    "<div class=\"container\">",
    renderHead(work, "work"),
    "<div class=\"projects\">",
    work.projects.map(renderProject).join("\n"),
    "</div>",
    "<p class=\"work__more\"" + build("frame text") + ">" + escapeHtml(work.more.label) + " " + more + "</p>",
    "</div>",
    "</section>"
  ].join("\n");
}

function renderStack(content) {
  const stack = content.stack;
  const groups = stack.groups.map(function (group) {
    const items = group.items.map(function (item) {
      return "<li class=\"chip\">" + escapeHtml(item) + "</li>";
    }).join("");
    return "<div class=\"stack__group\"" + build("frame text color check") + "><h3 class=\"stack__title\">" + escapeHtml(group.title) + "</h3><ul class=\"chips\">" + items + "</ul></div>";
  }).join("\n");
  return [
    "<section class=\"section\" id=\"stack\" data-section=\"stack\" aria-labelledby=\"stackTitle\">",
    "<div class=\"container\">",
    renderHead(stack, "stack"),
    "<div class=\"stack\">",
    groups,
    "</div>",
    "</div>",
    "</section>"
  ].join("\n");
}

function renderPriceCard(card) {
  const examples = card.examples.map(function (item) {
    return "<a " + external(item.url) + ">" + escapeHtml(item.label) + "</a>";
  }).join("\n");
  return [
    "<article class=\"price" + (card.main ? " price--main" : "") + "\"" + build("frame reveal text color check") + ">",
    "<h3 class=\"price__title\">" + escapeHtml(card.title) + "</h3>",
    "<p class=\"price__sub\">" + escapeHtml(card.sub) + "</p>",
    "<p class=\"price__val\"><small>от</small> " + escapeHtml(card.price) + "</p>",
    "<h4 class=\"price__label\">Кому</h4>",
    "<p class=\"price__text\">" + escapeHtml(card.who) + "</p>",
    "<h4 class=\"price__label\">Что получаете</h4>",
    "<p class=\"price__text\">" + escapeHtml(card.what) + "</p>",
    "<h4 class=\"price__label\">" + escapeHtml(card.examplesLabel) + "</h4>",
    "<p class=\"price__text price__links\">" + examples + "</p>",
    "</article>"
  ].join("\n");
}

function renderExtras(extras) {
  const items = extras.items.map(function (item) {
    const per = item.per ? " <small>" + escapeHtml(item.per) + "</small>" : "";
    return "<li class=\"extra\"><div><h4 class=\"extra__title\">" + escapeHtml(item.title) + "</h4><p class=\"extra__text\">" + escapeHtml(item.text) + "</p></div><b class=\"extra__price\">" + escapeHtml(item.price) + per + "</b></li>";
  }).join("\n");
  return [
    "<div class=\"extras\" id=\"extras\"" + build("frame reveal text check") + ">",
    "<h3 class=\"extras__title\">" + escapeHtml(extras.title) + "</h3>",
    "<ul class=\"extras__list\">",
    items,
    "</ul>",
    "</div>"
  ].join("\n");
}

function renderPrices(content) {
  const prices = content.prices;
  return [
    "<section class=\"section\" id=\"prices\" data-section=\"prices\" aria-labelledby=\"pricesTitle\">",
    "<div class=\"container\">",
    renderHead(prices, "prices"),
    "<div class=\"prices\">",
    prices.cards.map(renderPriceCard).join("\n"),
    "</div>",
    renderExtras(prices.extras),
    "<p class=\"prices__cta\"><a class=\"btn btn--accent\" " + external(content.telegram.url) + build("frame text color check") + ">" + escapeHtml(prices.cta) + "</a></p>",
    "</div>",
    "</section>"
  ].join("\n");
}

function renderFaq(content) {
  const faq = content.faq;
  const items = faq.items.map(function (item) {
    return "<details class=\"faq__item\"" + build("frame text check") + "><summary>" + escapeHtml(item.q) + "</summary><div class=\"faq__answer\"><p>" + escapeHtml(item.a) + "</p></div></details>";
  }).join("\n");
  return [
    "<section class=\"section\" id=\"faq\" data-section=\"faq\" aria-labelledby=\"faqTitle\">",
    "<div class=\"container faq\">",
    renderHead(faq, "faq"),
    "<div class=\"faq__list\">",
    items,
    "</div>",
    "</div>",
    "</section>"
  ].join("\n");
}

function renderContact(content) {
  const contact = content.contact;
  return [
    "<section class=\"section contact\" id=\"contact\" aria-labelledby=\"contactTitle\">",
    "<div class=\"container contact__inner\">",
    "<div class=\"swarm\" id=\"swarm\">",
    "<canvas class=\"swarm__canvas\" id=\"swarmCanvas\" aria-hidden=\"true\" data-word=\"" + escapeHtml(contact.swarmWord) + "\"></canvas>",
    "</div>",
    "<h2 class=\"contact__title\" id=\"contactTitle\">" + escapeHtml(contact.title) + "</h2>",
    "<p class=\"contact__text\">" + escapeHtml(contact.text) + "</p>",
    "<a class=\"btn btn--accent btn--xl\" " + external(content.telegram.url) + ">" + ICON_TELEGRAM + "<span>" + escapeHtml(contact.button) + "</span></a>",
    "<p class=\"contact__handle\">" + escapeHtml(content.telegram.handle) + "</p>",
    "</div>",
    "</section>"
  ].join("\n");
}

function renderFooter(content, count) {
  const caption = content.footer.caption.replace("{count}", String(count));
  return [
    "<footer class=\"foot\">",
    "<div class=\"container foot__inner\">",
    "<p class=\"foot__caption\" id=\"buildCaption\">" + escapeHtml(caption) + "</p>",
    "<p class=\"foot__copy\">" + escapeHtml(content.footer.copy) + "</p>",
    "</div>",
    "</footer>"
  ].join("\n");
}

/* Всё содержимое <body> между метками в index.html */
export function renderBody(content, options) {
  const count = options && options.cursorCount ? options.cursorCount : 18;
  return [
    "<a class=\"skip\" href=\"#work\">К работам</a>",
    renderHeader(content),
    "<main id=\"main\">",
    renderHero(content),
    renderWork(content),
    renderStack(content),
    renderPrices(content),
    renderFaq(content),
    renderContact(content),
    "</main>",
    renderFooter(content, count)
  ].join("\n");
}

/* Мета-теги <head> из content.meta */
export function renderMeta(content) {
  const meta = content.meta;
  return [
    "<title>" + escapeHtml(meta.title) + "</title>",
    "<meta name=\"description\" content=\"" + escapeHtml(meta.description) + "\">",
    "<link rel=\"canonical\" href=\"" + escapeHtml(meta.url) + "\">",
    "<meta property=\"og:type\" content=\"website\">",
    "<meta property=\"og:url\" content=\"" + escapeHtml(meta.url) + "\">",
    "<meta property=\"og:title\" content=\"" + escapeHtml(meta.title) + "\">",
    "<meta property=\"og:description\" content=\"" + escapeHtml(meta.description) + "\">",
    "<meta property=\"og:image\" content=\"" + escapeHtml(meta.ogImage) + "\">",
    "<meta property=\"og:image:alt\" content=\"" + escapeHtml(meta.ogImageAlt) + "\">",
    "<meta name=\"twitter:card\" content=\"summary_large_image\">"
  ].join("\n");
}
