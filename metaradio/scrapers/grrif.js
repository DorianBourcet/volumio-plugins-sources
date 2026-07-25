'use strict';

const BaseScraper = require('./base');

class GrrifScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);

    if (!Array.isArray(data) || data.length === 0) {
      return {};
    }

    // The latest logged track is the last element of the list.
    const current = data[data.length - 1];

    return {
      title: current.Title || undefined,
      artist: current.Artist || undefined,
      cover: current.URLCover || undefined,
    };
  }

}

module.exports = GrrifScraper;
