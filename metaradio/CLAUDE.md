# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`metaradio` is a Volumio 3 plugin of `plugin_type: music_service`. It exposes a curated list of
webradios as a browsable source and, while a station plays, repeatedly scrapes that station's
now-playing API to push track title / artist / album / cover art into Volumio's player UI.

It runs inside the Volumio host process (`index.js` exports a controller constructor that Volumio
instantiates), so there is no standalone entry point and no `main()` to run.

## Commands

There is no build, lint, or test tooling — `npm test` is the npm-init stub and will exit 1. Do not
add or invoke one unless asked.

```bash
npm install   # required before running anything locally; node_modules is not committed
```

To exercise a single scraper against the live API without a Volumio install (the fastest feedback
loop when adding or fixing a scraper), drive it directly and pass the station's `api` / `method`
from `radio_stations.json`:

```bash
METARADIO_DEBUG=full node -e "
const S = require('./scrapers/grrif');
new S().getMetadata('https://www.grrif.ch/live/covers.json', 'GET').then(r => console.log('RESULT', r), e => console.log('FAILED', e.message));
"
```

`base.js` logs the raw HTTP body (`LA REPONSE`) before parsing, so this also dumps the upstream
payload — use it to discover the response shape of a new API. That trace is gated behind
`METARADIO_DEBUG` because Volumio journals to an SD card and a scrape happens every few seconds
per playing station (see *Logging* below), hence the env var above.

Deploying to a device is done through Volumio's own plugin install flow; `install.sh` /
`uninstall.sh` are empty hook stubs (no apt packages needed).

### Logging

Volumio runs off an SD card, so **never add an unconditional `console.log` on a per-scrape or
per-tick path** — that is a continuous write to the card and it buries the error lines. Route
payload traces through `helpers/debug.js`:

- `debug.debugLog(...)` — same signature as `console.log`, no-op unless `METARADIO_DEBUG` is set.
- `debug.truncate(body)` — caps an HTTP body at 500 chars; returns it whole under
  `METARADIO_DEBUG=full`.

`METARADIO_DEBUG` unset (the device default) emits **no** payload traces at all. Error traces
(`FAILED TO QUERY API`, HTTP status, `TIMER_TASK_FAILED`, and `self.logger.error` calls) are
deliberately ungated: they are rare and are the ones worth having.

## Architecture

### Data flow

1. `addRadioResource()` loads `radio_stations.json` at plugin start. `getRadioContent()` flattens
   every station across all groups into one alphabetically sorted list (French collation) — the
   top-level group keys (`fip`, `radionova`, …) are *only* organisational in the JSON; they are not
   surfaced as browse folders.
2. Volumio calls `explodeUri()` with either the `uri` (`webfip/002`) or the stream `url`. It returns
   a track object carrying the station's `api`, `method` and `scraper` name — this is how scraper
   selection is wired: **the `scraper` field is the filename in `scrapers/`, `require`d dynamically**.
3. `clearAddPlayTrack()` hands the stream URL to the bundled `mpd` plugin, then calls
   `startPolling()`, which builds the scraper and the `Timer` together (or, for a station with no
   `scraper`, just pushes the station name once).
4. Each tick: `setMetadata()` → `getMetadata(station)` → cache lookup → `scraper.getMetadata()` →
   `hydrateMetadata(scraped, station)` → `setPlayingTrackInfo()`, which mutates both `vState` and the
   queue item and calls `commandRouter.servicePushState()`.

### Play generations

`self.playGeneration` is bumped by `newPlayGeneration()` on every play, stop, pause and resume.
`setMetadata()` snapshots both the generation and `self.currentStation` before scraping, and drops
the result if the generation no longer matches. This is what keeps a slow scrape of the previous
station from pushing its title onto the new one, and it is why **`hydrateMetadata` and
`getMetadata` take the station as an argument instead of reading `self.currentStation`** — reading
the live field at resolution time cached one station's metadata under another's key.

`clearAddPlayTrack` and `resume` also re-check the generation before installing their timer, because
the MPD round-trips in between give a second call time to overtake them. Anything that tears
playback down goes through `stopPolling()`, which stops the timer and nulls both `timer` and
`scraper` so no stale pair can be restarted later.

### Station entries (`radio_stations.json`)

Every entry has exactly: `title`, `uri` (`web<group>/NNN`, must be unique), `url` (stream),
`logo` (filename in `logos/`), `method`, `api` (now-playing endpoint), `scraper`. Adding a station
is normally a JSON entry + a logo file, reusing an existing scraper.

### Scrapers (`scrapers/`)

`base.js` handles the HTTP fetch and defines the contract: subclasses implement
`_scrapeMetadata(rawBody)` and return a plain object with any of
`{title, artist, album, cover, startTime, endTime, delayToRefresh}` — **all optional**. Return `{}`
to mean "nothing is playing"; `hydrateMetadata()` then falls back to the station name and logo.
`startTime`/`endTime` are Unix seconds and drive Volumio's seek bar and track duration; omit them
rather than guessing, since a wrong `endTime` makes the UI reset the track early.

Notes that matter when editing scrapers:

- `base.js` requires Node's `https` module, so an `api` served over plain `http` will not work.
- A `User-Agent` header is sent because some APIs (BBC/CloudFront) 403 without one.
- All HTTP goes through `base._httpRequest(url, {method, headers, body})`, which owns the 8s
  timeout, the response draining on non-2xx, and the premature-close handling. A POST API overrides
  `_fetchMetadata` to pass a `body` (see `jazz_radio.js`) rather than reimplementing the request —
  the previous duplicate had none of those guards.
- `getMetadata()` **rejects** on a transport or parsing failure. The controller's `.fail` turns that
  into the station-name placeholder and applies `computeScrapingFailureDtr()`, so a dead API stops
  being hammered. Swallowing the error in a scraper would silently disable that backoff.
- Overriding `getMetadata()` is the sanctioned way to see the request URL, since `base` does not
  forward it to `_scrapeMetadata` — `radio_france_high_def.js` does this to branch on the Radio
  France "visual" segment, and `radio_france_fip.js` uses it to issue a second fallback request.
- Family base classes carry the shared parsing and subclasses supply only a discriminator — see
  `nova_base.js` (subclasses override the `code` getter) and `radio_france_high_def.js`.
- Some scrapers parse HTML/embedded RSC payloads instead of JSON (`classic21.js`) because the
  broadcaster has no usable API. These are knowingly fragile; keep the explanatory comments.

### Polling cadence

Two mechanisms interact and both cap how often upstream APIs are hit:

- `helpers/timer.js` — a self-rescheduling `setTimeout` loop whose next delay is computed from the
  task's return value. `setMetadata()` returns `5`, so the timer ticks every 5s. `start()` is
  idempotent (a second call would otherwise fork a parallel chain that `stop()` can no longer
  reach), and the task is wrapped so that neither a rejection nor a synchronous throw can end the
  loop — a failed tick retries after `fallbackDelay` (30s). The `stopped` flag stops the
  *rescheduling*; what stops a late result from reaching the UI is the play generation, not this
  flag.
- `helpers/cache.js` — in-memory TTL cache keyed on a slug of the station's `uri` (which is the
  *stream* URL, since `explodeUri()` maps `station.url` onto `uri`), so most ticks are served from
  cache and no request is made. The TTL is the scraped `delayToRefresh`, clamped by
  `hydrateMetadata()` between `MIN_DELAY_TO_REFRESH` (20s) and `MAX_DELAY_TO_REFRESH` (900s), and
  derived from `endTime - now` when the scraper supplied one. A non-finite TTL falls back to 60s
  (it used to yield `validUntil = NaN`, which never compares as expired), `set()` prunes expired
  keys globally, and `onStop()` calls `clear()`.

On scrape failure, `computeScrapingFailureDtr()` backs off 15s → 60s → 120s → 300s → 600s → 900s and
caches the station-name placeholder for that long, so a dead API stops being hammered.

`setPlayingTrackInfo()` fingerprints the metadata (`object-hash`) and returns early when nothing
changed, since the 5s tick is far faster than the 20–900s cache TTL. `seek` is deliberately outside
the fingerprint so Volumio advances the progress bar itself between actual track changes.

### Volumio integration details

- Promises are `kew` (`libQ`), not native — use `.then()`/`.fail()`/`libQ.defer()` to match, since
  Volumio's command router expects kew promises. Note that kew **swallows unhandled rejections
  silently**: a chain without a `.fail()` does not crash, it just stops, which is why the timer and
  every playback method carry one.
- `pause()` delegates to `stop()` — webradio has nothing meaningful to pause — and returns its
  promise.
- `setPlayingTrackInfo()` resets `askedForPrefetch` / `prefetchDone` / `simulateStopStartDone` on the
  state machine — without this Volumio's prefetch logic fights the metadata updates.
- `setPlayingTrackInfo()` and `resetPlayingTrack()` bail out when `getState()` reports another
  `service`, or when the queue item at `vState.position` is gone (queue cleared mid-playback) —
  indexing it blindly used to throw and take the polling loop down with it.
- `explodeUri()` must stay side-effect free: Volumio also calls it to merely resolve a URI (queue
  append, browse), so tearing the timer down there froze the metadata of the station playing.
- Cover art for stations resolves through `/albumart?sourceicon=music_service/metaradio/logos/<logo>`.

### Dead / stub scaffolding

Left over from Volumio's `example_plugin` template and not wired to anything: `helpers/foo.js`,
`UIConfig.json` (no sections), `config.json`, `requiredConf.json`, and the `search`/`goto`/
`_search*` methods. `i18n/strings_en.json` still contains the template strings. Don't treat these as
live configuration surfaces; the plugin has no user-facing settings.

`helpers/foo.js` no longer has any importer. `computeStartTime()` / `computeEndTime()` and their
state (`computedStartTimes`, `latestTitleInfo`, `titleInfoAttempt`) were removed along with the
commented-out block in `hydrateMetadata` that was their only caller; `startTime` / `endTime` now come
from the scrapers only.
