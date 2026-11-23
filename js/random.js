/* Детерминированный генератор случайных чисел (mulberry32): [0, 1). Один seed — один и тот же рой */
export function createRandom(seed) {
  let value = seed >>> 0;
  return function next() {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
