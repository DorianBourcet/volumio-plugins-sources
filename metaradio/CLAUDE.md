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
node -e "
const S = require('./scrapers/grrif');
new S().getMetadata('https://www.grrif.ch/live/covers.json', 'GET').then(r => console.log('RESULT', r));
"
```

`base.js` logs the raw HTTP body (`LA REPONSE`) before parsing, so this also dumps the upstream
payload — use it to discover the response shape of a new API.

Deploying to a device is done through Volumio's own plugin install flow; `install.sh` /
`uninstall.sh` are empty hook stubs (no apt packages needed).

## Architecture

### Data flow

1. `addRadioResource()` loads `radio_stations.json` at plugin start. `getRadioContent()` flattens
   every station across all groups into one alphabetically sorted list (French collation) — the
   top-level group keys (`fip`, `radionova`, …) are *only* organisational in the JSON; they are not
   surfaced as browse folders.
2. Volumio calls `explodeUri()` with either the `uri` (`webfip/002`) or the stream `url`. It returns
   a track object carrying the station's `api`, `method` and `scraper` name — this is how scraper
   selection is wired: **the `scraper` field is the filename in `scrapers/`, `require`d dynamically**.
3. `clearAddPlayTrack()` hands the stream URL to the bundled `mpd` plugin, then, if the station has a
   `scraper`, starts a `Timer` that polls metadata.
4. Each tick: `setMetadata()` → `getMetadata()` → cache lookup → `scraper.getMetadata()` →
   `hydrateMetadata()` → `setPlayingTrackInfo()`, which mutates both `vState` and the queue item and
   calls `commandRouter.servicePushState()`.

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
- Errors are swallowed: `getMetadata()`'s `.fail` returns `{}`, so a broken scraper degrades to
  showing the station name rather than crashing playback.
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
  task's return value. `setMetadata()` returns `5`, so the timer ticks every 5s; the `stopped` flag
  is checked *after* the async task resolves specifically to neutralise an in-flight scrape that
  lands after `stop()`.
- `helpers/cache.js` — in-memory TTL cache keyed on a slug of `currentStation.uri` (which is the
  *stream* URL, since `explodeUri()` maps `station.url` onto `uri`), so most ticks are served from
  cache and no request is made. The TTL is the scraped `delayToRefresh`, clamped by
  `hydrateMetadata()` between `MIN_DELAY_TO_REFRESH` (20s) and `MAX_DELAY_TO_REFRESH` (900s), and
  derived from `endTime - now` when the scraper supplied one.

On scrape failure, `computeScrapingFailureDtr()` backs off 15s → 60s → 120s → 300s → 600s → 900s and
caches the station-name placeholder for that long, so a dead API stops being hammered.

### Volumio integration details

- Promises are `kew` (`libQ`), not native — use `.then()`/`.fail()`/`libQ.defer()` to match, since
  Volumio's command router expects kew promises.
- `pause()` currently delegates to `stop()` and returns early; the original pause body below that
  `return` is dead. Webradio has nothing meaningful to pause.
- `setPlayingTrackInfo()` resets `askedForPrefetch` / `prefetchDone` / `simulateStopStartDone` on the
  state machine — without this Volumio's prefetch logic fights the metadata updates.
- Cover art for stations resolves through `/albumart?sourceicon=music_service/metaradio/logos/<logo>`.

### Dead / stub scaffolding

Left over from Volumio's `example_plugin` template and not wired to anything: `helpers/foo.js`,
`UIConfig.json` (no sections), `config.json`, `requiredConf.json`, and the `search`/`goto`/
`_search*` methods. `i18n/strings_en.json` still contains the template strings. Don't treat these as
live configuration surfaces; the plugin has no user-facing settings.
