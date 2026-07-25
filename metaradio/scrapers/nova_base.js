'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

// Durations come as "MM:SS" (or "HH:MM:SS"); fold the parts into seconds.
function parseDuration(value) {
  if (!value) {
    return undefined;
  }
  const parts = String(value).split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) {
    return undefined;
  }
  return parts.reduce((total, n) => total * 60 + n, 0);
}

// Shared logic for every Nova webradio: they all pull the same all.json payload
// and differ only by the radio "code" each subclass targets.
class NovaBaseScraper extends BaseScraper {

  get code() {
    throw new Error('Nova scraper must define a "code".');
  }

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const entry = Array.isArray(data)
      ? data.find((e) => e && e.radio && e.radio.code === this.code)
      : undefined;

    const track = entry && entry.currentTrack;
    if (track && (track.title || track.artist)) {
      const startTime = track.diffusion_date
        ? dayjs.tz(track.diffusion_date, 'Europe/Paris').unix()
        : undefined;
      const duration = parseDuration(track.duration);
      return {
        title: track.title || undefined,
        artist: track.artist || undefined,
        cover: track.image || undefined,
        startTime,
        endTime:
          startTime !== undefined && duration !== undefined ? startTime + duration : undefined,
      };
    }

    // No music playing (e.g. a talk show): fall back to the current show.
    const show = entry && entry.currentShow;
    if (show && (show.title || show.author)) {
      return {
        title: show.title || undefined,
        artist: show.author || undefined,
        cover: show.cover || undefined,
      };
    }

    return {};
  }

}

module.exports = NovaBaseScraper;
