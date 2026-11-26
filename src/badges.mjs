// Watching badges: a small pixel building next to a name in the chat, grown by the hours a viewer has watched the
// live stream (users.watch_s). One list of thresholds for everything: the Worker puts the level on chat messages,
// build.mjs pastes the same list into the page (/*@badgeh*/[] in js/19-badges.js), which draws the pictures.
//
// BADGE_H[i] = hours needed for level i+1. Under the first threshold there is no badge (level 0).
// New viewers level up fast (1, 2, 4, 7, 11, 16 h: steps of 1, 1, 2, 3, 4, 5 h), then every level is 7 h more,
// up to 100 h; then one trophy level at 150 h. Change a number here and both sides follow on the next deploy.
export const BADGE_H = [1, 2, 4, 7, 11, 16, 23, 30, 37, 44, 51, 58, 65, 72, 79, 86, 93, 100, 150];

/** Level 0..BADGE_H.length for a number of watched seconds. */
export function badgeLevel(watchS) {
  const h = (Number(watchS) || 0) / 3600;
  let n = 0;
  while (n < BADGE_H.length && h >= BADGE_H[n]) n++;
  return n;
}
