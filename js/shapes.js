/* ==========================================================
   Формы роя — чистые функции без DOM (тестируются в Node).
   Слово рисуется своим «пиксельным» шрифтом 5×7 клеток: так точки ровно внутри букв
   и не зависят от того, какой шрифт загрузился; внутри букв — ровная сетка. Сердце — по формуле,
   точки равномерно по площади из последовательности Халтона: детерминированно и без сгустков.
   ========================================================== */

const GLYPH_COLUMNS = 5;
const GLYPH_ROWS = 7;

/* Пробел уже буквы: две клетки, иначе слова разъезжаются */
const SPACE_COLUMNS = 2;

/* Буквы 5×7: «#» — закрашенная клетка. Есть всё для «ДЛЯ ВАС» и «НАПИСАТЬ», и запас */
const GLYPHS = {
  "Д": ["..###", ".#..#", ".#..#", ".#..#", ".#..#", "#####", "#...#"],
  "Л": ["..###", ".#..#", ".#..#", ".#..#", ".#..#", "#...#", "#...#"],
  "Я": [".####", "#...#", "#...#", ".####", "..#.#", ".#..#", "#...#"],
  "В": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "Н": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "А": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "П": ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#"],
  "И": ["#...#", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#"],
  "С": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  "Т": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "Ь": ["#....", "#....", "#....", "####.", "#...#", "#...#", "####."],
  "Е": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "О": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "Р": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Ш": ["#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#####"],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."]
};

/* Последовательность Халтона: k-е число по основанию base, в [0, 1) */
export function halton(index, base) {
  let result = 0;
  let fraction = 1 / base;
  let value = index;
  while (value > 0) {
    result += fraction * (value % base);
    value = Math.floor(value / base);
    fraction /= base;
  }
  return result;
}

/* Раскладка слова в прямоугольник width×height: размер клетки и закрашенные клетки
   { x, y, size } в пикселях. Слово по центру, пропорции букв сохраняются. */
export function layoutText(text, width, height) {
  const chars = Array.from(String(text).toUpperCase());
  // Ширина знака в клетках: пробел узкий, остальное (и неизвестные знаки) — как буква
  const widths = chars.map(function (char) {
    return char === " " ? SPACE_COLUMNS : GLYPH_COLUMNS;
  });
  const columns = widths.reduce(function (sum, value) { return sum + value; }, 0) + Math.max(0, chars.length - 1);
  const size = columns === 0 ? 0 : Math.min(width / columns, height / GLYPH_ROWS);
  const left = (width - columns * size) / 2;
  const top = (height - GLYPH_ROWS * size) / 2;
  const cells = [];
  let offset = 0;
  chars.forEach(function (char, charIndex) {
    const glyph = GLYPHS[char];
    const start = offset;
    offset += widths[charIndex] + 1;
    if (!glyph) {
      // Пробел и неизвестные знаки — пустое место
      return;
    }
    for (let row = 0; row < GLYPH_ROWS; row++) {
      for (let column = 0; column < GLYPH_COLUMNS; column++) {
        if (glyph[row][column] === "#") {
          cells.push({ x: left + (start + column) * size, y: top + row * size, size: size });
        }
      }
    }
  });
  return { size: size, cells: cells };
}

/* Точка внутри буквы: попадает в закрашенную клетку раскладки */
export function isInsideText(layout, point) {
  return layout.cells.some(function (cell) {
    return point.x >= cell.x && point.x <= cell.x + cell.size && point.y >= cell.y && point.y <= cell.y + cell.size;
  });
}

/* Ровно count точек внутри букв слова, вписанного в width×height.
   Точки стоят ровной сеткой: в каждой клетке k×k мест (k — сколько влезает при count),
   поэтому края букв прямые и толщина штрихов везде одинаковая. Если точек больше, чем мест,
   лишние встают на те же места равномерно по слову (в рое их разводит «дыхание»);
   если меньше — места берутся через равный шаг. */
export function sampleTextPoints(text, width, height, count) {
  const layout = layoutText(text, width, height);
  const points = [];
  const cells = layout.cells.length;
  if (cells === 0 || count <= 0) {
    return points;
  }
  const k = Math.max(1, Math.floor(Math.sqrt(count / cells)));
  const spots = [];
  for (const cell of layout.cells) {
    for (let row = 0; row < k; row++) {
      for (let column = 0; column < k; column++) {
        spots.push({ x: cell.x + (column + 0.5) / k * cell.size, y: cell.y + (row + 0.5) / k * cell.size });
      }
    }
  }
  for (let index = 0; index < count; index++) {
    const spot = spots[Math.floor(index * spots.length / count)];
    points.push({ x: spot.x, y: spot.y });
  }
  return points;
}

/* Сердце: (x² + y² − 1)³ − x²·y³ ≤ 0. Рамка вокруг него в «сердечных» координатах */
const HEART_BOX = { left: -1.2, right: 1.2, top: 1.3, bottom: -1.05 };

export function isInsideHeartShape(x, y) {
  const base = x * x + y * y - 1;
  return base * base * base - x * x * y * y * y <= 0;
}

/* Точка единичного квадрата (y вниз, как на экране) → «сердечные» координаты */
export function unitToHeart(point) {
  return {
    x: HEART_BOX.left + point.x * (HEART_BOX.right - HEART_BOX.left),
    y: HEART_BOX.top - point.y * (HEART_BOX.top - HEART_BOX.bottom)
  };
}

export function isInsideHeart(point) {
  const heart = unitToHeart(point);
  return isInsideHeartShape(heart.x, heart.y);
}

/* Ровно count точек, равномерно по площади сердца, в единичном квадрате [0, 1]² (y вниз).
   Масштаб и место на экране задаёт вызывающий. */
export function heartPoints(count) {
  const points = [];
  for (let index = 1; points.length < count; index++) {
    const point = { x: halton(index, 2), y: halton(index, 3) };
    if (isInsideHeart(point)) {
      points.push(point);
    }
  }
  return points;
}

function orderByX(points) {
  return points.map(function (point, index) {
    return index;
  }).sort(function (first, second) {
    return points[first].x - points[second].x || points[first].y - points[second].y || first - second;
  });
}

/* Кто куда летит: перестановка mapping, from[i] → to[mapping[i]].
   Обе формы упорядочены слева направо и сопоставлены по месту в этом порядке:
   левая часть слова уходит в левую часть сердца — никто не летит через всю картинку. */
export function matchPoints(from, to) {
  const mapping = new Array(from.length);
  const fromOrder = orderByX(from);
  const toOrder = orderByX(to);
  for (let rank = 0; rank < fromOrder.length; rank++) {
    mapping[fromOrder[rank]] = toOrder[rank];
  }
  return mapping;
}
