---
name: webradio-metadata-discovery
description: >-
  Find the best audio stream URL and the metadata endpoint(s) for a webradio, for use in the
  metaradio Volumio plugin. Use when adding a new station to radio_stations.json, when asked to
  find a station's stream or "now playing" API, or when an existing station shows no metadata.
  Prefers highest-quality non-adaptive streams and ranks metadata endpoints by field richness
  (title, artist, album, cover, starttime, endtime).
---

# Webradio metadata discovery

Reverse-engineer a webradio down to two things: the **best audio stream URL** and the **HTTP
endpoint(s) that report what is currently on air**.

**Scope: discovery only.** Produce a report. Do not edit `radio_stations.json`, do not write a
scraper, do not touch plugin code — unless the user asks for that separately, after the report.

Always deliver the audio stream URL. Deliver one or two metadata URLs, ordered most important
first. Two traps drive the whole procedure:

- **Volumio does not choose a variant in a multivariant HLS playlist.** It stays on whatever
  resolves first, usually the lowest bitrate. There is no quality-selection code in the plugin —
  the choice is baked into the URL string. Commit `440ce6d` was a manual bulk fix for exactly
  this (every Radio France `<slug>/<slug>.m3u8` rewritten to `<slug>/<slug>_hifi.m3u8`). Get it
  right at discovery time or it stays wrong.
- **One endpoint is often not enough.** During a talk show the "now playing track" API goes
  empty (Radio France returns the sentinel `Le direct`). A secondary "current show" endpoint
  keeps the UI populated. `scrapers/radio_france_fip.js` is the precedent; `scrapers/bbc_6_music.js`
  is the counter-example that goes blank during shows.

## 0. Inputs

Station name, plus its homepage or player URL. If given only a name, find the official site with
WebSearch and confirm the exact station — networks carry many near-identical sub-stations
(FIP vs FIP Cultes, ICI Musique vs ICI Musique Classique). Never proceed on a guessed domain.

## 1. Capture what the player actually loads

In order of preference:

1. **`claude-in-chrome`** — `navigate` to the player page, start playback, then
   `read_network_requests`. Filter on `m3u8|mp3|aac|\.pls|\.m3u$` for audio, and on XHR/fetch
   JSON responses for metadata. This is the only method that reveals POST bodies and required
   headers, so prefer it whenever the browser is available.
2. **`WebFetch` / `curl` the page** and grep the HTML and JS bundles for stream URLs and API
   hostnames.
3. **Provider conventions** — see `references/known-providers.md`. Check this file early anyway:
   if the station belongs to a known network, it short-circuits most of the work.

Once any stream URL is in hand, read its ICY headers — they often identify the hosting platform
and the station's own slug, which is what platform metadata APIs key on:

```bash
curl -sI -A 'Mozilla/5.0' -H 'Icy-MetaData: 1' "$STREAM_URL"
# icy-name / icy-url / icy-br  →  station slug, homepage, real bitrate
```

## 2. Choose the audio stream

In priority order:

- **Prefer a direct constant-bitrate HTTP stream** (`.mp3`, `.aac`, `.aacp`, an Icecast or
  Shoutcast mount) at the highest bitrate offered. This is what most non-Radio-France stations in
  `radio_stations.json` use, e.g. `https://jazzradio.ice.infomaniak.ch/jazzradio-high.mp3`.

- **Never hand back a multivariant HLS playlist.** Fetch any candidate `.m3u8` and count its
  `#EXT-X-STREAM-INF` lines:

  ```bash
  curl -s -A 'Mozilla/5.0' "$URL" | grep -c '#EXT-X-STREAM-INF'
  ```

  | count | meaning | action |
  |---|---|---|
  | 0 | media playlist (segments only) | safe, use as-is |
  | 1 | single-variant playlist | safe — this is what `_hifi.m3u8` is, and why `440ce6d` works |
  | ≥2 | multivariant / adaptive | **reject**: resolve the child playlist with the highest `BANDWIDTH`, return that URL instead, then re-verify it is a media playlist |

  When a master was rejected, say so in the report and list the discarded variants.

- **Probe for a better sibling** by substituting quality markers in the URL, validating each
  candidate with a real request. Patterns that pay off:

  | from | try |
  |---|---|
  | `-128`, `aac-128` | `-192`, `-256`, `-320`, `aac-256` |
  | `lofi` | `midfi`, `hifi` |
  | `/slug/slug.m3u8` | `/slug/slug_hifi.m3u8` |
  | `low`, `sd`, `mp3` | `high`, `hd`, `aac` |
  | `-audio%3d96000` (BBC) | `-audio%3d128000`, `-audio%3d320000` |

  Keep only variants that return 2xx **and** actually deliver audio — some servers answer 200 with
  an error page.

- **Verify the chosen URL:**

  ```bash
  curl -sI -A 'Mozilla/5.0' -H 'Icy-MetaData: 1' "$URL"
  ```

  Expect 2xx and an `audio/*` or `application/vnd.apple.mpegurl` content type. Note `icy-br`,
  `icy-name`, `icy-audio-info` when present, and report the real bitrate and codec. If `HEAD` is
  refused, use `curl -s -A 'Mozilla/5.0' -D - -o /dev/null --max-time 5 -r 0-1024 "$URL"`.

- **Flag, never silently return**, a URL that carries an expiring token or signature query
  parameter, or that looks geo-restricted. Those break once pasted into `radio_stations.json`.

## 3. Find the metadata endpoints

Build a candidate list from the captured XHR calls plus `references/known-providers.md`. For each
candidate, record: method (GET/POST), POST body, required headers, and a real response sample.

Score every candidate by how many of these fields it carries — this is the ranking criterion:

**title · artist · album · cover · starttime · endtime**

The endpoint that reports the **current music track** with the most of those fields is the
primary. Tie-breakers, in order:

1. JSON over HTML scraping — there is no DOM parser server-side, so HTML means regex
   (see the comments in `scrapers/classic21.js` and `scrapers/rts_couleur3.js`).
2. No auth, no API key, no token.
3. Stable hostname and path (not a build-hashed Next.js route).
4. **`https`** — `scrapers/base.js` uses `require('https')` unconditionally, so an `http://`
   endpoint is unusable as-is and must be flagged.

## 4. Always look for a secondary "current show" endpoint

**Mandatory step, not conditional.** Even when the primary endpoint looks complete, check —
its coverage during talk programmes is what you cannot see from a single sample.

Where the secondary hides:

- **Same API, different parameter.** Radio France `livemeta` swaps the trailing *visual* segment:
  `.../live/7/fip_extended` (tracks) → `.../live/7/fip_player` (shows). See
  `scrapers/radio_france_fip.js`.
- **Sibling path.** BBC RMS exposes `/segments/latest` (tracks) next to `/broadcasts/poll`
  (programmes). Generic path names worth trying: `schedule`, `program`, `programme`, `emission`,
  `broadcast`, `onair`, `now`, `live`, `epg`.
- **Already inside the primary payload.** Several stations return both layers in one response —
  a programme object with a nested list of tracks. Then there is no second URL, and the report
  must say so explicitly, describing how to pick the track in range and fall back to the
  programme. Precedents: `scrapers/r_c_ici_musique_classique.js`, `scrapers/nova_base.js`,
  `scrapers/rts_couleur3.js`.

Confirm the secondary by sampling it while a talk or live segment is airing. If the schedule does
not cooperate, at minimum verify it returns a show title, host, cover, and start/end times, and
say in the report that the empty-primary case was not observed directly.

## 5. Validate over time

Poll each retained endpoint at least 3 times, 60–90 s apart. Confirm the payload actually changes,
then determine:

- **Timestamp format** — epoch seconds vs milliseconds vs ISO 8601. The plugin expects **epoch
  seconds**; note any conversion needed.
- **Stream-delay offset** — API timestamps often run ahead of the audio. Existing Radio France
  scrapers add `+23 s`. Measure and report it if observable.
- **Sentinel values** meaning "nothing on air", so a scraper can return `{}` instead of garbage.
  Known ones in this repo: `Le direct` (Radio France), `[break]` (KCRW), `:-)` (Radio Classique),
  `play_type !== 'trackplay'` (KEXP), empty title.
- **Refresh cadence** — ideally derived from `endtime`. The plugin clamps to 20–900 s and defaults
  to 60 s.

## 6. Report

Required output shape:

```
## <Station name>

### Audio stream  (always present)
<url>
- codec / bitrate / playlist type, and how it was verified
- rejected alternatives and why
  (e.g. "master.m3u8 exposes 4 variants — using the 320k child playlist")

### Metadata endpoint 1 — <what it reports>   (primary, richest)
<url>
- method: GET | POST      body: <…>      headers: <…>
- fields: title ✓  artist ✓  album ✗  cover ✓  starttime ✓  endtime ✓
- JSON path for each field
- sample response (trimmed)
- sentinel for "nothing on air": <…>

### Metadata endpoint 2 — current show   (secondary, optional)
<same structure, plus: when the primary goes empty and this one takes over>

### Notes
timestamp format · stream-delay offset · refresh cadence · caveats (token, geo, http-only)
```

Closing rules:

- The audio stream URL is **always** present.
- One or two metadata URLs, **most important first** (current track, then current show).
- If a station genuinely has no usable metadata endpoint, say so plainly rather than returning a
  weak one. The plugin degrades gracefully to station name + logo when `api` and `scraper` are
  absent from the station entry.
- If both layers come from a single endpoint, return one URL and describe the two layers.

## Etiquette

- Always send `-A 'Mozilla/5.0'`. BBC and CloudFront answer 403 without a User-Agent — see the
  comment in `scrapers/base.js`.
- Poll for discovery; do not hammer. A handful of requests per endpoint is enough.
- Prefer the station's own public API over third-party aggregators, which lag and lose fields.
