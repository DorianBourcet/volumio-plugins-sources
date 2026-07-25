# Known provider patterns

Lookup table for stream and metadata URL conventions. Check here before running the full
investigation — if the station belongs to one of these networks, most of the work is already done.
Patterns marked **verified** were confirmed against live endpoints; the rest come from station
entries already working in `radio_stations.json`.

Always re-verify the exact URL for the station at hand: ids, slugs and bitrates change.

---

## Radio France (FIP, France Inter/Culture/Musique, and all webradios)

**Stream** — `https://stream.radiofrance.fr/<slug>/<slug>_hifi.m3u8?id=radiofrance`

The `_hifi` suffix is mandatory. Without it the URL resolves to a lower-bitrate variant — this is
what commit `440ce6d` fixed in bulk. **Verified:** `fip_hifi.m3u8` is a *media* playlist
(0 `#EXT-X-STREAM-INF`, 4 s AAC segments), so it is safe to hand to Volumio as-is.

**Metadata** — `https://api.radiofrance.fr/livemeta/live/<stationId>/<visual>`

`<stationId>` is a numeric id (FIP 7, France Inter 1, France Musique 4, France Culture 5, FIP
Jazz 65, FIP Rock 64, …). `<visual>` selects the *response shape* and is the lever for the
secondary endpoint:

| visual | reports |
|---|---|
| `<name>_extended` (e.g. `fip_extended`) | current music track — richest, use as primary |
| `<name>_player` (e.g. `fip_player`) | current show / programme — **secondary** |
| `transistor_<name>_player`, `musique_player` | talk stations, programme-oriented |

Secondary derivation: swap the trailing segment, as `scrapers/radio_france_fip.js` does
(`fip_extended` → `fip_player`).

- **Sentinel:** `Le direct` means nothing identifiable is on air (exported as `DIRECT_LABEL` from
  `scrapers/radio_france_high_def.js`).
- **Covers:** `https://www.radiofrance.fr/pikapi/images/<visualId>/800x800`
- **Times:** epoch seconds; existing scrapers add **+23 s** for stream delay (older
  `radio_france*.js` use +7 s).
- On `_player`, a track fills all three lines (`firstLine`/`secondLine`/`thirdLine`); an empty
  `thirdLine` means it is a show, not a track.

---

## BBC

**Stream** — `http://as-hls-ww-live.akamaized.net/pool_<n>/live/ww/<service>/<service>.isml/<service>-audio%3d<bitrate>.norewind.m3u8`

The bitrate is **in the path**, URL-encoded (`%3d` = `=`). The repo currently uses `96000` for
6 Music; probe `128000` / `320000` before settling. Each such URL is a single-variant playlist —
do not use the `.isml/*.m3u8` master.

**Metadata** — RMS, `https://rms.api.bbc.co.uk/v2/…`

| endpoint | reports |
|---|---|
| `services/<service>/segments/latest?experience=domestic&offset=0&limit=4` | current music track — **primary** |
| `experience/inline/play/<service>` | current programme **and** recent tracks — **secondary** (verified) |

`segments/latest`: pick `items.find(i => i.offset && i.offset.now_playing)`, then
`titles.primary` → artist, `titles.secondary` → title, `image_url.replace('{recipe}','640x640')`
→ cover. No start/end times.

`experience/inline/play/<service>` is the endpoint BBC Sounds itself uses, and it is the richer
of the two for the show layer. **Verified** shape:

- `data[0]` (`id: "live_play_area"`) → `data[0]` is the on-air `broadcast_summary`:
  `titles.primary` (show), `titles.secondary` (episode strapline), `synopses.short`,
  `start` / `end` (**ISO 8601**, convert to epoch seconds), `image_url` with a `{recipe}`
  placeholder. `data[0].data[1]` is the *next* broadcast — do not mistake it for the current one.
- `data[1]` (`id: "recent_tracks"`) → `segment_item` list, most recent first;
  `titles.primary` → artist, `titles.secondary` → title.

`scrapers/bbc_6_music.js` uses only the primary today, so the station goes blank during talk
shows. This is the untapped secondary.

**Dead ends, do not retry:** `services/<service>/broadcasts/poll`,
`services/<service>/schedule/now`, `services/<service>/broadcasts/latest` all 404.
`v2/broadcasts/latest?serviceId=<service>` returns 200 but **ignores the filter** — it hands back
another station's broadcasts.

**A User-Agent header is required** — BBC/CloudFront answer 403 without one.

---

## Radio-Canada / OHdio

**Stream** — `https://rcavliveaudio.akamaized.net/hls/live/<id>/<code>/adaptive_<bitrate>/chunklist_ao.m3u8`

**Never use `master.m3u8` here. Verified:** `…/2007000/MUSE/master.m3u8` (ICI Musique Classique)
advertises **8** variants, lowest first — 48/96/128/192 kbps across two pools. Take the
`adaptive_192` child directly. ICI Musique and ICI Première in `radio_stations.json` already do;
ICI Musique Classique still points at the master and should be corrected to
`…/2007000/MUSE/adaptive_192/chunklist_ao.m3u8`.

**Metadata** — two generations coexist:

- `https://services.radio-canada.ca/neuro/sphere/v1/audio/apps/live-schedules/…` — returns a
  programme (`broadcast`: title, hosts, picture, start/end) **with a nested `musics` array**.
  One endpoint, two layers: pick the music entry whose range contains now, fall back to the
  programme. See `scrapers/r_c_ici_musique_classique.js`, `scrapers/r_c_ici_musique.js`.
- `https://services.radio-canada.ca/bff/audio/graphql?opname=liveSchedules&extensions=…` —
  persisted GraphQL query; the `sha256Hash` is build-specific and **will break** on site
  redeploys. Prefer the `neuro/sphere` REST form when both work.

---

## Nova (Radio Nova and its webradios)

**Stream** — `http://<slug>.ice.infomaniak.ch/<slug>-256.aac` (256 kbps AAC, the best offered).

**Metadata** — one shared endpoint for the whole network:
`https://www.nova.fr/radios-data/www.nova.fr/all.json`

The station is selected by a `code` inside the payload — `scrapers/nova_base.js` plus one thin
subclass per station overriding `get code()`. Track and show are **both in the same response**:
no music playing (talk show) ⇒ fall back to the show's `title` / `author` / `cover`.

---

## Infomaniak (`*.ice.infomaniak.ch`)

Very common for French/Swiss stations. Mount suffixes indicate quality — probe upward:

`-128.aac` · `-192` · `-256.aac` · `-320` · `-high.mp3` (usually 256+ kbps)

Examples in the repo: `jazzradio-high.mp3`, `tsfjazz-high.mp3`, `ouifm-high.mp3`,
`radioclassique-high.mp3`, `grrif-128.aac`, `radionova-256.aac`.

---

## Icecast

- Mount list / status: `/status-json.xsl` (JSON), `/status.xsl` (HTML)
- Per-mount fields: `icestats.source[].title`, `.server_name`, `.bitrate`, `.listenurl`
- Usually gives only a combined `"Artist - Title"` string: no album, no cover, no times.
  Treat as a last resort and look for a station-specific API first.

## Shoutcast

- `/stats?json=1`, `/7.html`, `/currentsong`, `/played.html`
- Same limitation: one `songtitle` string, typically `"Artist - Title"`.

## ICY in-stream metadata

`curl -sI -A 'Mozilla/5.0' -H 'Icy-MetaData: 1' <stream>` exposes `icy-br`, `icy-name`,
`icy-genre`, `icy-audio-info`. Useful for **verifying bitrate**, not as a metadata source — the
plugin reads metadata over HTTP, not from the stream.

---

## laut.fm

- **Stream:** `https://stream.laut.fm/<station>`
- **Metadata:** `https://api.laut.fm/station/<station>/current_song` — title, artist, album,
  `started_at` and `ends_at` (ISO 8601, convert to epoch seconds). One of the richest generic
  APIs; no secondary endpoint needed.
- Schedule, if ever needed: `https://api.laut.fm/station/<station>/schedule`

## RadioKing

- **Stream:** `https://listen.radioking.com/radio/<id>/stream/<mountId>` — numeric ids.
- **Metadata (verified):** `https://api.radioking.io/widget/radio/<slug>/track/current` — returns
  `title`, `artist`, `album`, `cover`, `started_at`, `end_at`, `duration`, `is_live`,
  `default_cover` (true ⇒ the cover is a placeholder, prefer the station logo).
  Times are **ISO 8601**.
- **The path takes the slug, not the numeric id** — `…/widget/radio/256885/track/current` 404s.
  Recover the slug from the stream's ICY headers:

  ```bash
  curl -sI -A 'Mozilla/5.0' -H 'Icy-MetaData: 1' https://listen.radioking.com/radio/<id>/stream/<mountId>
  # icy-url: https://www.radioking.com/radio/radio-classique-quebec-92-7   → slug
  # icy-br:  320                                                          → bitrate
  ```

- Not always the best source: Radio Classique QC in `radio_stations.json` streams from RadioKing
  but takes metadata from the station's own site, which carries richer classical fields
  (composer, performers). Compare both before choosing.

## StreamGuys

- **Stream:** `https://<station>-<codec>-<bitrate>.streamguys1.com/<mount>` — the bitrate is in
  the hostname (`kexp-mp3-128`), so probe `-256`, `-320`, and `aac` variants.
- Metadata is station-specific (KEXP uses `https://api.kexp.org/v2/plays/?format=json`; keep only
  entries where `play_type === 'trackplay'` — everything else is an air-break or promo).

---

## Sites with no JSON API — last resort

There is **no DOM parser server-side** in the plugin, so HTML means regex. Only go here when
every JSON avenue is exhausted, and warn the user that the scraper will be brittle.

- **Next.js / React Server Components** — the data sits in the `self.__next_f.push([1,"…"])`
  payload embedded in the HTML. Precedent: `scrapers/classic21.js` (RTBF).
- **Live "popup" player pages** — a small HTML page built for an embedded player, far easier to
  regex than the main site. Precedent: `scrapers/rts_couleur3.js`
  (`https://www.rts.ch/audio-podcast/livepopup/<station>/`).
- **CloudFront-hosted JSON side-files** — some sites ship a static JSON refreshed server-side,
  e.g. Radio Classique's `https://d3gf3bsqck8svl.cloudfront.net/direct-metadata/current.json`.
  Worth grepping the page's JS bundle for `cloudfront.net` and `.json`.

**RTS Couleur 3 stream note — verified:** `…/couleur3/master.m3u8` advertises 2 variants
(192 k and 96 k). Use `…/couleur3/variant-192.m3u8` instead of the master.

---

## POST-based metadata endpoints

Not everything is a GET. `scrapers/base.js` passes a `method` through, and
`_fetchMetadata` can be overridden to send a body:

- **Jazz Radio** — `POST https://www.jazzradio.fr/lite/update_onair` with JSON body
  `{"radio_ids":["1"]}` and explicit `Content-Type` / `Content-Length` headers
  (see `scrapers/jazz_radio.js`).
- **TSF Jazz** — `POST https://www.tsfjazz.com/player/qect`

Only the browser network capture reveals these — a page-source grep will miss the body.

---

## Sentinel values already seen

Values that mean "nothing identifiable on air", so a scraper returns `{}`:

| value | station |
|---|---|
| `Le direct` | Radio France |
| `[break]` | KCRW |
| `:-)` (as artist) | Radio Classique |
| `play_type !== 'trackplay'` | KEXP |
| empty / missing title | generic |
