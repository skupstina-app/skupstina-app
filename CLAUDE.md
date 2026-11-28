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
| Uživo panels: "više" button (2×2 tiles, far right of the speaker bar) → icon tabs: speech stats / Poslovnik; MP profile (tap the speaker photo), time badge on the photo | `html/live.html` (`#p-stats`, `#p-prof`) | `95-panels` | `79-panels` (template bio, seat map: circles that would overlap push apart while a spring pulls them to their seat, `spread()`, with a thin line back to the seat when moved; the list shows each MP's photo ringed in his group colour; `tlDay()`: the stats say which day they are about — danas / juče / date — from `sitting` of `/api/live/speakers` (last time the stream was live; "" → "na poslednjoj sednici")) |
| Sala (seating map), sastav, poslanici | `html/sala.html` | `30-sala` | `28-seatplan` (who sits where, shared with the admin), `30-hall` (Sastav / Poslanici is a menu under the hall; on phones the hall stays in view and only the list scrolls; Poslanici: search + filter button `#fbtn` (stranka, pol via `isF`, godine from `by`), a tap on a row or a seat zooms the hall to that MP (`mpZoom`) and the camera follows the list; pixel corner focus `fcsMark`) |
| Rang, govornici | `html/rang.html` | `40-rang` | `50-tabs-rang`, `60-govornici` |
| Arhiva (list of days → one day → its recording with a timeline; see Arhiva below) | `html/arhiva.html` | `50-arhiva` | `65-arhiva` |
| Podešavanja (gear tab, `#profil`): account card with avatar + Izmeni, Ć/Ћ and sun/moon switches, rows, Odjavi se; avatar picker `#avDlg`; mutes, rules dialog; Admin meni `#admDlg` (admins only) | `html/profil.html` | `70-profil`, `71-admin` | `20-chat` (account card, avatar picker), `21-admin` (Admin meni), `55-mutes` |
| Kontakt | `html/kontakt.html` | `90-launch-kontakt` | |
| Bottom tab bar (phones) | `html/tabbar.html` | `80-tabbar` | `50-tabs-rang` |
| Footer | `html/footer.html` | | |
| Logo, favicon, home-screen icons, link preview | `index.html` (meta, og:*), header/footer inline logo | `10-nav` (`.mark`) | `scripts/icons.py` → `assets/icons/` → `src/generated/icons.js`, served at `/favicon.svg`, `/favicon.ico`, `/icons/*`, `/og.png`; `/manifest.webmanifest` (`MANIFEST` in worker.js) |
| Info button (top right): Beleške (Novo / Sledeće) and a suggestion box (`/api/contact`, kind `predlog`) | `html/header.html` (`#infoPop`) | `80-tabbar` | `25-info` |
| Data, helpers, boot | | `00-base` | `00-data`, `05-core`, `25-info`, `40-timeline-views`, `74-install-card` (add to home screen), `99-boot` |

The logo is the pixel building from "Dolazi uskoro" (23×21). Change it in `scripts/icons.py` (`LOGO`), run it (with the
@fontsource Wix Madefor Display folder as argument for `og.png`), and paste the new paths into header/footer.

## Poslovnik

- Text: `scripts/poslovnik.py` reads the official page (parlament.gov.rs, "Ceo Poslovnik (prečišćeni tekst)", URL in the script) →
  `assets/poslovnik.json` ({n, g glava, o odeljak, s: [[stav, alineje…]…]}), served at `/poslovnik.json`. Run it again when the Rules change.
- Page: `js/80-poslovnik.js`, `css/97-poslovnik.css`. Book tab: type the article, optionally the stav ("107 1" / "107.1");
  stavovi are numbered rows, the asked one lit, chips jump between stavovi; empty box = all articles by glava.
- Live: the viewer's open article (typed or picked, held 2 s; a preview never counts) goes to `ChatRoom` (`{t:"psl",n}`, kept on the
  socket). `pslHot` is strict: ≥`PSL_MIN` viewers opened the same article within `PSL_WIN`, they are ≥`PSL_SHARE` of everyone
  connected and ≥`PSL_FOCUS` of all who opened any article. Then everyone on Uživo during a broadcast gets a small pop-up under
  the speaker bar (once per article per 10 min, gone after 40 s), and the book tab shows that article as a preview.
- Arhiva: `pslRefs()` in arhiva.js finds "povreda Poslovnika … član N (stav M)" in the transcript (only breach speeches, first
  line naming an article, not Ustav/Kodeks/zakon) → `doc.psl` [at, speech end, član, stav]. While it plays, a book chip with the
  number shows next to the speaker; tap → the article in a bubble, the stav lit.

## Accounts and chat

- Visitor accounts (`src/auth.js`, D1 `users`): Sign in with Google (same `GOOGLE_CLIENT_ID`) or email + password
  (PBKDF2). A new account picks a chat name (the chat's name rules, unique); it gets a random free name colour.
  Session cookie `sk_s` signed with `SALT`, 180 days. Routes `/api/auth/me|google|login|register|profile|logout`.
- One account per email; chat names are unique per account (unique indexes on `users.email`, `users.nk`, `users.sub`,
  created by `src/auth.js`). There are no other names: the old anonymous names (browser key + IP) are removed.
- The name can be changed once every 30 days (`users.name_changed_at`, `NAME_DAYS` in auth.js; the first name at sign-up
  doesn't count, and in the first 24 h after sign-up, `NAME_FREE_H`, changes are free); colour any time (see Name colours). A new name is confirmed in the dialog first ("next change in 30 days"). Name, colour,
  avatar and sign-out live in Podešavanja (the gear tab), not under the chat box.
- Name colours (`src/colors.mjs`, the only list): `COLORS[n]` = [light, dark] text colour of `.u<n>` (build.mjs writes the CSS
  at `/*@ucolors*/` in `css/96-auth.css` and pastes the file's functions at `/*@colors*/` in `js/20-chat.js`). 28 colours, shown
  pastel set first, then darker (`COLOR_SHOW`, 14 + 14). Light blue, light green, light orange (0-2) are open for everyone;
  one more opens every 2 h of `watch_s`, in a random order per account (`colorOrder(uid)`, seeded, same on both sides).
  Locked ones are a "?" tile. Picked in Podešavanja by tapping the account name (`#colDlg`: only the grid, × and tap outside to close, "Gledaj skupštinu da otključaš još boja" at the bottom while some are locked), saved by `POST /api/auth/color`
  (checks `colorsOpen`; the colour an account already has stays allowed). Not asked at sign-up. New colour: append to
  `COLORS` (never renumber) and place it in `COLOR_SHOW`.
- Avatars: every PNG in `assets/avatars/64` (64 px, file name = id) can be picked; `assets/avatars/uskoro` holds the
  "coming soon" tiles and the empty avatar (`prazno`), drawn by `scripts/avatar-placeholders.py`. `build.mjs` turns them
  into `src/generated/avatars.js` (served by the Worker at `/a/<id>.png`, `/a/uskoro-<n>.png`) and fills
  `/*@avatars*/[]` and `/*@soon*/[]` in `js/20-chat.js`. Saved in `users.avatar` (`POST /api/auth/avatar`, any time).
  Add an avatar: drop its 64 px PNG in `assets/avatars/64` (and a label in `AVN` in 20-chat.js).
- Tap a name in the chat → a small card (`#upop`, 20-chat.js): avatar, name, watching time (clock + hours only, no
  words; never the email) from `GET /api/auth/user?id=`, and Blokiraj/Odblokiraj. Watching time (`20-chat.js`): every 10 s
  counts while the Assembly is on air (`apiLive || plLive`, also when the viewer is behind live or resumes later) and the
  player plays in a visible tab; muted playback only counts within 30 min of a tap/key/scroll (the page autoplays muted).
  No broadcast = nothing counts, not even a replay. Sent to `POST /api/auth/watch` every 5 min and on leaving (beacon as
  `text/plain`); one atomic UPDATE in auth.js adds `users.watch_s`, never more than the time since the last report
  (`watch_at`, so tabs/devices don't add up) and at most `WATCH_DAY_S` = 14 h per Belgrade day (`watch_day`, `watch_day_s`).
- Watching badges: a 15×15 pixel building in front of the name in the chat, grown by `watch_s`. The hour thresholds live
  only in `src/badges.mjs` (`BADGE_H`, 19 levels: a quick ramp 1, 2, 4, 7, 11, 16 h, then every 7 h up to 100 h, and a gold trophy at 150 h); `ChatRoom` stores the writer's level on
  each message (`msgs.badge`, sent as `m.b`) and `build.mjs` fills `/*@badgeh*/[]` in `js/19-badges.js`, which draws the
  pictures once as SVG `<symbol>`s (`#bdg-1`…) and gives `badgeSvg(n)` (`<use>`). The levels have no names on screen.
  Also in the user card (next to the hours) and in Podešavanja in front of the account name (`#pLvl`, faint before the
  first hour); a tap there shows a bubble with watched/next hours, e.g. `137/175h` (`#pLvlB`).
- Moderator gavel: a chat moderator (admin with the `mod` menu, `userAdmin` in admin.js, checked fresh on every message)
  gets a 15×15 pixel gavel between his watching badge and his name. `ChatRoom` stores it on the message (`msgs.moder`, sent
  as `m.md: 1`); `19-badges.js` draws it once as `#bdg-mod` and gives `modSvg()`. A super admin (the owner) gets a crown
  instead of the gavel (`msgs.moder` = 2, `m.cr: 1`, `#bdg-crown`, `crownSvg()`), still after his watching badge.
- Blocking: D1 `blocks(uid,bid)`, `POST /api/auth/block {id,on}`; the list comes with `/api/auth/me` (`blocks`). Only the
  blocker stops seeing the messages (hidden in the page). Podešavanja → Blokirani korisnici lists them (Odblokiraj; empty: "Nemaš blokiranih korisnika.").
- Obriši nalog: `POST /api/auth/delete` removes the user row and his blocks (refused while banned).
- Theme: light / dark / auto (`tema` in localStorage; auto follows the device and its changes; the default).
- Chat (`ChatRoom` in worker.js, page `js/20-chat.js`): anyone can read; there is no history (a viewer sees messages
  from when they open the page). Only signed-in users can post; the Worker passes the user id to the room as `x-user`,
  and the room reads name, colour and `banned_until` (ms) from D1 `users` on every message. Rate limits, reports
  and bans are per account (`/admin/chat/ban?uid=…`); 3 messages hidden by reports in an hour = 24 h ban.
- Test locally: `npx wrangler dev --local --local-upstream localhost:8787` (needs `.dev.vars` with `SALT`, and the
  tables created with `wrangler d1 execute DB --local`).

## Admin

- Admins (`src/admin.js`): the super admin is fixed in code (`SUPER` = mgrahovac87@gmail.com: every menu, and the only one
  who manages admins). The others are in D1 `admins(email, perms, added_by, at)`; `perms` = the admin menus they see,
  `sala` and/or `mod`. `ADMIN_EMAILS` (wrangler.jsonc) only seeded that table once, with `sala` (row `#seeded` marks it).
- An admin is known by his site account: signed in with Google and without a password (an email + password address is
  never checked, so it can't make anyone admin). `/api/auth/me` returns `admin: {super, perms}` (or null).
- Podešavanja → **Admin meni** (only for admins; `21-admin.js`, `71-admin.css`, `#admDlg` in `html/profil.html`):
  **Admini** (super admin only: add by email, tick Sala/Moderator, remove; `GET/POST /admin/api/admins
  {email, perms[] | remove}`), **Poruke** (super admin only: suggestions from Beleške and contact messages, D1 `messages`; filter Sve/Predlozi/Kontakt, delete; `GET/POST /admin/api/poruke {id, remove}`), **Sala** (link to `/admin/sala`), **Moderator** (only the look for now: tiles and rows marked
  "uskoro"; the real chat tools still live at `/admin/chat?key=`).
- `/admin/sala`: seat map editor (`src/admin/sala.html`, routes in `src/admin.js`). Opens straight away for an admin with
  `sala` who is signed in on the site (no second sign-in, no Odjavi button, ‹ goes back to the site). Otherwise it offers
  its own Sign in with Google: the ID token is checked against `GOOGLE_CLIENT_ID` and the email must be an admin with
  `sala`; that gives a session cookie `sk_admin` (signed with the `SALT` secret, 30 days). Seats are saved in `mps.seat` as `row-section-index`
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
  free seat of his own group. The editor does not show the automatic places: it draws saved seats only (so an accidental tap saves nothing).
- Editor: moves are drag only (pointer events, mouse and touch; on touch list rows drag by the photo, and on the hall a swipe
  moves the hall, also over people: press and hold someone 250 ms to pick him up, then drag; the page itself never scrolls; the filters are remembered in the browser, localStorage `sala-f`); a tap opens a card
  with the photo big (to recognise the face), simple info, lock and remove. A plain drag doesn't move a locked MP; press and hold him (450 ms) to unlock,
  then drag on. `mps.seat_lock` = 1 locks an MP on his seat
  (column added by `ensureLockCol` in admin.js; `POST /admin/api/lock {id,lock}`). The lock is only an editor guard: dropping
  someone on a locked MP swaps them, and "Skloni sa mesta" (card, or drag to the list) unlocks and removes. Zoom: buttons, Ctrl/⌘+wheel, double-click, two-finger pinch. On phones the map fills the screen and the list below is a bottom sheet: down it shows 3 rows, tap or drag its handle to raise it to 70% of the screen (bigger photos, more rows); starting a drag from the list lowers it again; browser page zoom is off so the list stays sharp. Filters (stranka, mesto: neraspoređeni/raspoređeni, pol) sit in one button next to search; pol is guessed from the first name (`sexOf`, -a = female, with exception lists `MALE_A`/`FEM_X`), since the import has no gender field.
- Seat changes reach the site fast: a save drops the cached page and `/api/seats` in that data centre; open pages poll
  `/api/seats` (saved seats only, edge cache 15 s) 4 s after load and every minute, and redraw every map.
- Other `/admin/*` pages still use `?key=ADMIN_KEY`.

## Arhiva

- One sitting day = one document in D1 `ar_dan` (`doc` JSON, `tekst` = transcript for later search). `src/arhiva.js`:
  - **Import** (`arhivaImport`, cron every 10 min): https://skupstina.live/data/sessions.json lists their days; a day that is
    new or updated there (`src_updated`) is read whole (`traka-<id>.json`) and turned into our document by `buildDoc`:
    `parts` [{v, at, dur, s0}] (YouTube videos, or stretches of one stream, back to back with the pauses cut out),
    `speeches` [at, dur, mp|null, name if not an MP, clock, summary, chair], `ev` (glasanje and konstatacija from their
    votes, kvorum left out; opomena found by us in the chair's words, see `opomene()`), `agenda`, `inter`. All `at` are
    day seconds. At most 2 days per run. Days of the 15th convocation (17, 18, 19, 24, 25 Nov 2026) come from here.
  - **Opomene** (`opomene()`): the chair gives one now ("izričem vam opomenu", "moram da vam izreknem opomenu"), not
    talks about one. Sure = the MP is named in that sentence or the next two ("… Gospodine Mirkoviću"), or the chair cut
    into one MP's speech (same MP before and after) → `ev`. Not sure → `cand` (with the MPs who spoke around it), which
    signed-in visitors confirm in the recording (a bubble while it plays; `GET/POST /api/arhiva/potvrde`, D1
    `ar_potvrda`): settled by an admin's answer, or by ≥3 answers with one side ≥3× the other. "izrekao sam opomenu X …
    povlačim" takes X's opomena back. `PARSER` (in arhiva.js) is part of `src_updated`: bump it and every day is read again.
  - **Stenografske beleške** (`src/beleske.js`, cron, hourly; every 30 min while a day has none): the Assembly's own
    transcript (.docx) is the last word on opomene. Found through the Redovna/Vanredna zasedanja pages → the sitting's
    page → its `stenografske_beleske/*.docx` links (date from the file name); read again when size/date change. The docx is
    unzipped in the Worker (`docxParas`), `parseSten` finds who got one (name in the sentence; "i vama" → the last two who
    shouted from the seats; else the last one who shouted; else the MP cut off; "povlačim" takes it back) and the vote
    counts. `applySten` puts them on the timeline (our find at that time, then a crowd question, then the chair's turn),
    drops ours the notes don't have, clears the crowd questions, marks matching votes `ok`. D1 `ar_beleske(date, url, sig,
    st, log)`; also applied after every re-import, so the notes always win.
  - **Roles change over time** (a temporary chair at the first sittings, new groups): each doc keeps that day's
    `who` {mp: [role, list]} and `chairs`; speeches by the chair carry the chair flag and are left out of "Najviše govorili".
  - **Our own days** (`arhivaCron`): the reader's `speech_segments` (one stream = one day) → `arhiva_dani` (title,
    `start_ms`, `len_s` from the stream's YouTube page, which YouTube often refuses to Cloudflare, then null). Such a day
    shows (`obrada: 1`, "u obradi") only until the import has the same date.
  - Routes: `GET /api/arhiva` (list, with `hay` and `lines` for search), `GET /api/arhiva/day?d=<date>` (the document).
- List / Kalendar switch next to search (`#arVw`, remembered in localStorage `ar-v`): the calendar (`arCal`) draws a month grid per month (newest first), sitting days as tiles with a duration bar and opomene; months are split by a plain "Novembar 2026" line. The titles "Arhiva" / "Sala" show only on wide screens (`.head.dt`).
- Page (`65-arhiva.js`): `#arhiva[data-v=list|day|play]`, the phone's back button walks back (history state `{ar}`).
  The recording plays the day's parts back to back in our own YouTube player (`arP`; the live `yt` is paused): at a
  part's end the next part loads, or inside one stream we jump over the pause. Clock times come from the speeches'
  clocks. Day page: Ukratko (headlines of passed votes and konstatacije, not "Povreda Poslovnika"), dnevni red, the
  live stats' `seatMap()` + `.xlist`, opomene, glasanja; every row opens the recording at that moment. The list hides
  chair turns under 45 s. Filters: Sve / Opomene / Glasanja / one MP. Search uses `sfold` and drops the last letter of
  long words; the line that matched shows under the day.
- Sources are not shown under the content: they are listed in O sajtu → Izvori (`html/kontakt.html`, Podešavanja on phones) and the footer.
- "Sledeća sednica" (YouTube's next scheduled plenary stream, from `yt_video`) shows only on the newest day, until a newer day is in.
- Open to everyone since 27 Nov 2026 (`body.arh`, set for all in 65-arhiva.js).
- **Kanal** (`src/kanal.js`, cron): the @ParlamentSrbija channel through the YouTube Data API (secret `YT_API_KEY`):
  new uploads every run, older ones backfilled from `KANAL_FROM`, plenary videos of the last 21 days and live/upcoming
  ones asked again hourly (`gone` = YouTube no longer has it). `classify(title)` → `kind` (sednica / glasanje / pitanja,
  else null: committees, press conferences, meetings…), `skey` (one sitting across its days: Latin look-alike letters
  folded, "Prva sednica" and "nastavak Prve sednice" the same), `date`, `part` ((I)…(VI)). Stored in D1 `yt_video`.
  It fills `start_ms` (actualStartTime) and `dan` (rank of the date in its sitting) of our own days. `GET /api/kanal`:
  days with their stream and parts in order, the live and the next scheduled sitting.
- Next (not built yet): the reader run over a day's parts, so our speech times hold after the live stream is deleted
  (the channel deletes it some days after uploading the parts; then a day must play from the parts); the same title rule
  in the reader, so only sittings are live.

## Search

Every search box ignores Serbian diacritics and script: `sfold()` (in `js/05-core.js`, copied into `src/admin/sala.html`) turns
Cyrillic into Latin, č/ć→c, š→s, ž→z, đ/dj→d, drops other accents and lower-cases. Run both the query and the text through it.
A new search must use `sfold` too.

## UX rule: no explanations

The UI must explain itself. Don't add helper text, subtitles or hints that say what a screen or button does: a clear
label is enough (tap "Blokirani korisnici" → you know what is there). A screen shows its content, an empty state in a few
words ("Nemaš blokiranih korisnika."), and one obvious action per item. If something seems to need an explanation, fix
the label or the layout instead. Keep only text the user can't do without (e.g. "this can't be undone" before deleting).

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

Updates reach open pages and home-screen apps: the page HTML is sent with `cache-control: no-cache` (the edge still keeps
it 5 min, keyed by the page hash). `build.mjs` writes that hash into the page (`"/*@ver*/"` in `js/98-update.js`);
the page asks `/api/version`, reloads by itself when it comes back on screen after a minute away and a new version is
out, and otherwise marks Podešavanja → Osveži aplikaciju with "novo" (that row always reloads fresh).
