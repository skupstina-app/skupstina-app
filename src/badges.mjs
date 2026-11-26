// Watching badges: a small pixel building next to a name in the chat, grown by the hours a viewer has watched the
// live stream (users.watch_s). One list of thresholds for everything: the Worker puts the level on chat messages,
// build.mjs pastes the same list into the page (/*@badgeh*/[] in js/19-badges.js), which draws the pictures.
//
// BADGE_H[i] = hours needed for level i+1. Under the first threshold there is no badge (level 0).
// New viewers level up fast (1, 2, 4, 7, 13, 25 h), then each step needs more hours than the one before, so that
// watching 5 h a day every day reaches the last level in about 5 months (750 h).
// Change a number here and both sides follow on the next deploy.
export const BADGE_H = [1, 2, 4, 7, 13, 25, 45, 70, 105, 150, 200, 255, 320, 390, 470, 555, 650, 750];

/** Level 0..BADGE_H.length for a number of watched seconds. */
export function badgeLevel(watchS) {
  const h = (Number(watchS) || 0) / 3600;
  let n = 0;
  while (n < BADGE_H.length && h >= BADGE_H[n]) n++;
  return n;
}
