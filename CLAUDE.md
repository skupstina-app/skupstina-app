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
| Uživo panels: stats (podium button) and MP profile (tap the speaker photo), time badge on the photo | `html/live.html` (`#p-stats`, `#p-prof`) | `95-panels` | `79-panels` (template bio, seat map) |
| Sala (seating map), sastav, poslanici | `html/sala.html` | `30-sala` | `30-hall` |
| Rang, govornici | `html/rang.html` | `40-rang` | `50-tabs-rang`, `60-govornici` |
| Arhiva | `html/arhiva.html` | `50-arhiva` | `65-arhiva` |
| Profil, mutes, rules dialog | `html/profil.html` | `70-profil` | `55-mutes` |
| Kontakt | `html/kontakt.html` | `90-launch-kontakt` | |
| Bottom tab bar (phones) | `html/tabbar.html` | `80-tabbar` | `50-tabs-rang` |
| Footer | `html/footer.html` | | |
| Data, helpers, boot | | `00-base` | `00-data`, `05-core`, `25-info`, `40-timeline-views`, `74-install-card` (add to home screen), `99-boot` |

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
