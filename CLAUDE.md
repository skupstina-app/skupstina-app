# skupstina.app — site

Map of this repo. Read this first, then open only the file you need.

## How it fits together

- `src/worker.js` — the Cloudflare Worker (bundled JS, edit in place): serves the page, `/api/mps`, `/api/contact`,
  `/api/chat` (Durable Object `ChatRoom`, SQLite), MP import from parlament.gov.rs (cron every 10 min, D1 `DB`),
  `/admin/*` (needs `?key=ADMIN_KEY`).
- `/api/live/speakers` is served by the **other repo**, `skupstina-app/skupstina-reader` (it reads who is speaking
  from the stream). Its route runs in front of this Worker.
- The page is **one HTML file built from parts** in `src/page/` by `build.mjs` → `src/generated/index.html`
  (git-ignored). `wrangler deploy`/`dev` run the build automatically. The Worker replaces `/*MPS*/[]` with the MP
  list at request time — that placeholder must stay (it is in `js/00-data.js`).
- All the page's JS is one classic `<script>`: the files in `src/page/js/` are concatenated in name order and share
  one scope. Same for `src/page/css/` into one `<style>`. Keep the number prefixes; add a file by picking a prefix.
- Old: earlier versions were published into D1 (`assets` table, `index.html` + `backup/…`). The Worker no longer
  reads them; the repo is the source of truth.

## Where things are

| Area | HTML | CSS | JS |
|---|---|---|---|
| Head, fonts, first styles | `index.html` (shell) | | |
| Top nav, menu sheet | `html/header.html` | `10-nav` | `10-nav` |
| Uživo: player, speaker bar, chat, live stats | `html/live.html` | `20-live-window`, `60-uzivo`, `85-chat` | `15-live`, `20-chat`, `45-numbers`, `70-mini-fullscreen`, `72-mute-engine`, `76-player`, `78-live-status` |
| Uživo panels: stats (podium button) and MP profile (tap the speaker photo), time badge on the photo | `html/live.html` (`#p-stats`, `#p-prof`) | `95-panels` | `79-panels` (template bio, seat map, `tlDay()`: the stats say which day they are about — danas / juče / date — from `sitting` of `/api/live/speakers` (last time the stream was live; "" → "na poslednjoj sednici")) |
| Sala (seating map), sastav, poslanici | `html/sala.html` | `30-sala` | `28-seatplan` (who sits where, shared with the admin), `30-hall` |
| Rang, govornici | `html/rang.html` | `40-rang` | `50-tabs-rang`, `60-govornici` |
| Arhiva | `html/arhiva.html` | `50-arhiva` | `65-arhiva` |
| Podešavanja (gear tab, `#profil`): account card with avatar + Izmeni, Ć/Ћ and sun/moon switches, rows, Odjavi se; avatar picker `#avDlg`; mutes, rules dialog | `html/profil.html` | `70-profil` | `20-chat` (account card, avatar picker), `55-mutes` |
| Kontakt | `html/kontakt.html` | `90-launch-kontakt` | |
| Bottom tab bar (phones) | `html/tabbar.html` | `80-tabbar` | `50-tabs-rang` |
| Footer | `html/footer.html` | | |
| Data, helpers, boot | | `00-base` | `00-data`, `05-core`, `25-info`, `40-timeline-views`, `74-install-card` (add to home screen), `99-boot` |

## Accounts and chat

- Visitor accounts (`src/auth.js`, D1 `users`): Sign in with Google (same `GOOGLE_CLIENT_ID`) or email + password
  (PBKDF2). A new account picks a chat name (the chat's name rules, unique) and a colour 0-7 (`.u0`-`.u7`).
  Session cookie `sk_s` signed with `SALT`, 180 days. Routes `/api/auth/me|google|login|register|profile|logout`.
- One account per email; chat names are unique per account (unique indexes on `users.email`, `users.nk`, `users.sub`,
  created by `src/auth.js`). There are no other names: the old anonymous names (browser key + IP) are removed.
- The name can be changed once every 30 days (`users.name_changed_at`, `NAME_DAYS` in auth.js; the first name at sign-up
  doesn't count, and in the first 24 h after sign-up, `NAME_FREE_H`, changes are free); colour any time. A new name is confirmed in the dialog first ("next change in 30 days"). Name, colour,
  avatar and sign-out live in Podešavanja (the gear tab), not under the chat box.
- Avatars: every PNG in `assets/avatars/64` (64 px, file name = id) can be picked; `assets/avatars/uskoro` holds the
  "coming soon" tiles and the empty avatar (`prazno`), drawn by `scripts/avatar-placeholders.py`. `build.mjs` turns them
  into `src/generated/avatars.js` (served by the Worker at `/a/<id>.png`, `/a/uskoro-<n>.png`) and fills
  `/*@avatars*/[]` and `/*@soon*/[]` in `js/20-chat.js`. Saved in `users.avatar` (`POST /api/auth/avatar`, any time).
  Add an avatar: drop its 64 px PNG in `assets/avatars/64` (and a label in `AVN` in 20-chat.js).
- Tap a name in the chat → a small card (`#upop`, 20-chat.js): avatar, name, watching time (clock + hours only, no
  words; never the email) from `GET /api/auth/user?id=`, and Blokiraj/Odblokiraj. Watching time: the page counts the
  seconds the stream really plays on screen and sends them to `POST /api/auth/watch` (every 5 min and on leaving);
  `users.watch_s`, never more than the time since the last report (`watch_at`).
- Blocking: D1 `blocks(uid,bid)`, `POST /api/auth/block {id,on}`; the list comes with `/api/auth/me` (`blocks`). Only the
  blocker stops seeing the messages (hidden in the page). Podešavanja → Blokirani lists them (Odblokiraj).
- Obriši nalog: `POST /api/auth/delete` removes the user row and his blocks (refused while banned).
- Theme: light / dark / auto (`tema` in localStorage; auto follows the device and its changes; the default).
- Chat (`ChatRoom` in worker.js, page `js/20-chat.js`): anyone can read; there is no history (a viewer sees messages
  from when they open the page). Only signed-in users can post; the Worker passes the user id to the room as `x-user`,
  and the room reads name, colour and `banned_until` (ms) from D1 `users` on every message. Rate limits, reports
  and bans are per account (`/admin/chat/ban?uid=…`); 3 messages hidden by reports in an hour = 24 h ban.
- Test locally: `npx wrangler dev --local --local-upstream localhost:8787` (needs `.dev.vars` with `SALT`, and the
  tables created with `wrangler d1 execute DB --local`).

## Admin

- `/admin/sala`: seat map editor (`src/admin/sala.html`, routes in `src/admin.js`). Sign in with Google: the ID token
  is checked against `GOOGLE_CLIENT_ID`; only emails in `ADMIN_EMAILS` (both in wrangler.jsonc vars) get a session
  cookie (signed with the `SALT` secret, 30 days). Seats are saved in `mps.seat` as `row-section-index`
  (row 0 nearest the presidium; section 0 and index 0 on the right as seen on the broadcast, same as `30-hall.js`).
  8 sections: the six inner ones have 7 rows, 3,4,5,5,6,7,8 (the 3-seat front row juts out one row nearer the presidium); the two
  outer ones start one row back, level with the inner second row, and have 6 rows, 6,7,7,7,8,8 (314 seats). The row in a key
  is counted inside its section (outer row 0 sits on the hall's second ring).
  The Speaker and vice-presidents sit on the presidium bench instead: 9 places `p-0`..`p-8` (left to right as on the
  broadcast): 4 VPs, `p-4` the Speaker, `p-5` secretary general, `p-6` deputy secretary general, 2 VPs (GS and ZGS sit
  on the Speaker's own left, as in the hall). GS and GSD are
  not MPs and their places are fixed.
- One seat plan for every map: `src/page/js/28-seatplan.js` (`hallSeats`, `seatPlan`, `benchSlots`). The site uses it through
  `seatLayout()` in `30-hall.js` (Sala and the stats panel map); `build.mjs` pastes the same file into the editor at `/*@seatplan*/`
  → `src/generated/sala.html` (what admin.js serves). Saved seats win; everyone else gets an automatic seat in his group's wedge
  (groups go round the hall in the order their saved seats show), and a save only pushes the person who sat there to the nearest
  free seat of his own group. The editor draws the automatic places faded (dashed): drag one to save a seat, or tap → "Sačuvaj ovo mesto".
- Editor: moves are drag only (pointer events, mouse and touch; on touch list rows drag by the photo); a tap opens a card
  with simple info, lock and remove. A plain drag doesn't move a locked MP; press and hold him (450 ms) to unlock,
  then drag on. `mps.seat_lock` = 1 locks an MP on his seat
  (column added by `ensureLockCol` in admin.js; `POST /admin/api/lock {id,lock}`). The lock is only an editor guard: dropping
  someone on a locked MP swaps them, and "Skloni sa mesta" (card, or drag to the list) unlocks and removes. Zoom: buttons, Ctrl/⌘+wheel, double-click, two-finger pinch.
- Seat changes reach the site fast: a save drops the cached page and `/api/seats` in that data centre; open pages poll
  `/api/seats` (saved seats only, edge cache 15 s) 4 s after load and every minute, and redraw every map.
- Other `/admin/*` pages still use `?key=ADMIN_KEY`.

## Style

Dark/light via `:root[data-mode=dark]` CSS variables (`--bg`, `--card`, `--ink`, `--mute`, `--line`, `--live` teal…).
Fonts: Wix Madefor Text/Display; pixel accents in Departure Mono (`.px`). Icons are pixel-art inline SVGs
(`<rect>`s, `shape-rendering="crispEdges"`), not stroke icons. Copy is Serbian (Latin). Mobile first.
Group colours: Studentska lista red; Srbija pobeđuje near-black (use a light grey/off-white on dark backgrounds).

## Deploy

Push to `main` → GitHub Actions builds, `wrangler deploy`, smoke-tests https://skupstina.app (needs repo secrets
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Pull requests only build. Roll back: Cloudflare dashboard →
Workers → skupstina → Deployments, or revert the commit.

Check a change locally: `node build.mjs` then `npx wrangler deploy --dry-run --outdir /tmp/out`.
