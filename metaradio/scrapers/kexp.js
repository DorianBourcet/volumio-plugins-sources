'use strict';

const BaseScraper = require('./base');

class KexpScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const results = Array.isArray(data.results) ? data.results : [];

    // The feed mixes real songs with "airbreak" entries; keep the latest trackplay.
    const play = results.find((p) => p.play_type === 'trackplay');
    if (!play || (!play.song && !play.artist)) {
      return {};
    }

    const startTime = play.airdate
      ? Math.floor(new Date(play.airdate).getTime() / 1000)
      : undefined;

    return {
      title: play.song || undefined,
      artist: play.artist || undefined,
      album: play.album || undefined,
      cover: play.image_uri || play.thumbnail_uri || undefined,
      startTime,
    };
  }

}

module.exports = KexpScraper;
