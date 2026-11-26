// Chat name colours. One list for everything: auth.js checks a pick against it, build.mjs writes the .u<n> CSS rules
// from it and pastes the functions below into the page (/*@colors*/ in js/20-chat.js), which draws the picker.
//
// COLORS[n] = [light-mode text, dark-mode text] for colour n (users.color). 0-7 are the old palette, keep their numbers.
// Every account always has COLOR_FREE (light blue, light green, light orange). Every COLOR_STEP_H hours of watching the
// live stream (users.watch_s) opens one more, in an order of its own for each account (colorOrder, seeded by the user id),
// so not everyone opens the same ones. The picker shows them in COLOR_SHOW order: the pastel set first, then the darker one
// (14 + 14, two rows of 7 each). A new colour goes at the end of COLORS (numbers in use never move), its place in COLOR_SHOW.
export const COLORS = [
  // pastel set
  ["#1c7ed6", "#74c0fc"], // 0 svetlo plava
  ["#2b8a3e", "#69db7c"], // 1 svetlo zelena
  ["#d9480f", "#ffa94d"], // 2 svetlo narandžasta
  ["#ae3ec9", "#e599f7"], // 3 lila
  ["#0c8599", "#66d9e8"], // 4 tirkizna
  ["#c2255c", "#f783ac"], // 5 roze
  ["#5f3dc4", "#b197fc"], // 6 lavanda
  ["#b7791f", "#ffd43b"], // 7 žuta
  ["#e03131", "#ff8787"], // 8 koralna
  ["#5c940d", "#c0eb75"], // 9 limeta
  ["#087f5b", "#63e6be"], // 10 menta
  ["#3b5bdb", "#91a7ff"], // 11 periwinkle
  ["#a15c38", "#f4b18c"], // 12 breskva
  // darker set
  ["#0b4f9c", "#3d8bfd"], // 13 plava
  ["#1b5e20", "#40c057"], // 14 zelena
  ["#a63e00", "#fd7e14"], // 15 narandžasta
  ["#7b1fa2", "#cc5de8"], // 16 ljubičasta
  ["#0b6e75", "#22b8cf"], // 17 petrolej
  ["#b00020", "#fa5252"], // 18 crvena
  ["#3a2b9c", "#845ef7"], // 19 indigo
  ["#8a5a00", "#fab005"], // 20 zlatna
  ["#5c6b00", "#a9e34b"], // 21 maslinasta
  ["#a1006b", "#f06595"], // 22 magenta
  ["#6d4c41", "#d0a27a"], // 23 braon
  ["#006d4b", "#20c997"], // 24 smaragdna
  ["#455a64", "#a5b4bd"], // 25 škriljac
  ["#7f1d1d", "#e8705f"], // 26 bordo
  // added later to the pastel set (COLOR_SHOW puts it there)
  ["#8f6b2e", "#e6cc9a"], // 27 pesak
];
export const COLOR_FREE = [0, 1, 2];
export const COLOR_STEP_H = 2;
export const COLOR_SHOW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 27, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];

/** The order in which this account opens the locked colours (the same every time for the same id). */
export function colorOrder(uid) {
  let s = (Math.imul((Number(uid) || 0) + 1, 2654435761) ^ 0x5bd1e995) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = COLOR_SHOW.filter((c) => !COLOR_FREE.includes(c));
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Colours this account can pick now: the free ones and one more for every COLOR_STEP_H hours watched. */
export function colorsOpen(uid, watchS) {
  const n = Math.floor((Number(watchS) || 0) / (COLOR_STEP_H * 3600));
  return [...COLOR_FREE, ...colorOrder(uid).slice(0, n)];
}
