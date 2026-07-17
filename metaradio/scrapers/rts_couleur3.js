'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const ZONE = 'Europe/Zurich';

// The RTS live popup is an HTML page; metaradio has no DOM parser, so extract the
// few fields we need by regex.
function decodeEntities(str) {
  if (!str) {
    return str;
  }
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function firstMatch(html, regex) {
  const m = html.match(regex);
  return m ? decodeEntities(m[1]) : undefined;
}

class RtsCouleur3Scraper extends BaseScraper {

  _scrapeMetadata(html) {
    // Most recent logged track (song-items are ordered newest first).
    const songBlock = html.match(
      /<article class="song-item"[^>]*data-song-dt="([^"]*)"[\s\S]*?<\/article>/,
    );
    let songDt;
    let songTitle;
    let songArtist;
    if (songBlock) {
      songDt = songBlock[1];
      songTitle = firstMatch(songBlock[0], /<h3 class="title[^"]*">([\s\S]*?)<\/h3>/);
      songArtist = firstMatch(songBlock[0], /<p class="artist">([\s\S]*?)<\/p>/);
    }

    // Current show block (#livePopupNowPlaying).
    const showBlock = html.match(/<article id="livePopupNowPlaying">[\s\S]*?<\/article>/);
    let showTitle;
    let showCover;
    let showStart;
    if (showBlock) {
      showTitle = firstMatch(showBlock[0], /<h1 class="media-title">([\s\S]*?)<\/h1>/);
      showCover = firstMatch(showBlock[0], /<div class="thumbnail">[\s\S]*?<img[^>]*src="([^"]*)"/);
      showStart = this._showStart(firstMatch(showBlock[0], /<time class="bait">([^<]*)<\/time>/));
    }

    // The latest logged track is the live one only while a song plays within the
    // current show. When a (talk) show is on air, the song list goes stale, so the
    // show supplants the last track.
    const songEpoch = songDt ? dayjs(songDt).unix() : NaN;
    const showSupplants =
      Number.isNaN(songEpoch) || (showStart !== undefined && songEpoch < showStart);

    if (!showSupplants && (songTitle || songArtist)) {
      return {
        title: songTitle || undefined,
        artist: songArtist || undefined,
        startTime: Number.isNaN(songEpoch) ? undefined : songEpoch,
      };
    }

    if (showTitle || showCover) {
      return {
        title: showTitle || undefined,
        cover: showCover || undefined,
      };
    }

    return {};
  }

  // The "bait" is the show slot, e.g. "19:00 - 21:00", wall-clock Zurich time with
  // no date. Interpret its start (HH:mm) on today's Zurich date → epoch seconds.
  _showStart(bait) {
    const m = bait && bait.match(/(\d{1,2}):(\d{2})/);
    if (!m) {
      return undefined;
    }
    const today = dayjs().tz(ZONE).format('YYYY-MM-DD');
    return dayjs.tz(today + 'T' + m[1].padStart(2, '0') + ':' + m[2], ZONE).unix();
  }

}

module.exports = RtsCouleur3Scraper;
