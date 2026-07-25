'use strict';

const BaseScraper = require('./base');

class TsfJazzScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const current = data.current;

    if (!current) {
      return {};
    }

    const startTime = current.start_time || undefined;
    const duration = current.duration != null ? Math.ceil(current.duration) : undefined;

    return {
      title: current.title || undefined,
      artist: current.artist || undefined,
      cover: current.cover || undefined,
      startTime,
      endTime: startTime !== undefined && duration !== undefined ? startTime + duration : undefined,
    };
  }

}

module.exports = TsfJazzScraper;
