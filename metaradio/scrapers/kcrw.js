'use strict';

const BaseScraper = require('./base');

class KcrwScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);

    // Between tracks the API reports a "[break]" placeholder, not a real song.
    if (data.title && data.title.trim().toLowerCase() === '[break]') {
      return {};
    }

    return {
      title: data.title || undefined,
      artist: data.artist || undefined,
      album: data.album || undefined,
      cover: data.albumImageLarge || data.albumImage || undefined,
    };
  }

}

module.exports = KcrwScraper;
