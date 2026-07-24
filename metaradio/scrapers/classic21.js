'use strict';

const BaseScraper = require('./base');

// RTBF has no clean now-playing JSON API (its Radioplayer mirror is geo-fenced to
// Belgium), so the track list is scraped from the Next.js RSC payload embedded in the
// "retrouver-un-titre" page. This is inherently fragile to RTBF markup changes.

// The track JSON is escaped inside JS string literals of `self.__next_f.push([1,"…"])`.
// Concatenate every chunk, then unescape so the embedded JSON becomes parseable.
function extractRscPayload(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)];
  const joined = chunks.map((m) => m[1]).join('');
  try {
    return JSON.parse('"' + joined + '"');
  } catch (e) {
    return joined;
  }
}

// Parse every `{"id":<n>,"title":…,"albumCover":{…}}` object by walking balanced braces
// from each match — robust to the surrounding RSC noise.
function parseTracks(payload) {
  const tracks = [];
  const re = /\{"id":\d+,"title":/g;
  let match;
  while ((match = re.exec(payload)) !== null) {
    const start = match.index;
    let depth = 0;
    for (let i = start; i < payload.length; i++) {
      const c = payload[i];
      if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(payload.slice(start, i + 1));
            if (obj.albumCover) {
              tracks.push(obj);
            }
          } catch (e) {
            // skip malformed slice
          }
          break;
        }
      }
    }
  }
  return tracks;
}

function coverUrl(track) {
  const albumCover = track.albumCover || {};
  const xl = (albumCover.cover && albumCover.cover.xl) ||
    (albumCover.illustration && albumCover.illustration.xl);
  if (!xl) {
    return undefined;
  }
  return xl.indexOf('?') === -1 ? xl + '?webp=1' : xl;
}

class Classic21Scraper extends BaseScraper {

  _scrapeMetadata(html) {
    const tracks = parseTracks(extractRscPayload(html));
    if (tracks.length === 0) {
      return {};
    }

    // Current track = latest dateTime not in the future.
    const now = Date.now();
    const dated = tracks
      .map((t) => ({ t, at: t.dateTime ? Date.parse(t.dateTime) : NaN }))
      .filter((x) => Number.isFinite(x.at) && x.at <= now)
      .sort((a, b) => b.at - a.at)[0];

    const chosen = dated ? dated.t : tracks[0];
    const startTime = chosen.dateTime ? Date.parse(chosen.dateTime) : NaN;

    return {
      title: chosen.title || undefined,
      artist: chosen.performer || undefined,
      album: chosen.album || undefined,
      cover: coverUrl(chosen),
      startTime: Number.isFinite(startTime) ? Math.floor(startTime / 1000) : undefined,
    };
  }

}

module.exports = Classic21Scraper;
