'use strict';

const BaseScraper = require('./base');

class Bbc6MusicScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const items = Array.isArray(data.data) ? data.data : [];

    const current = items.find((item) => item.offset && item.offset.now_playing);
    if (!current || !current.titles) {
      return {};
    }

    const artist = current.titles.primary || undefined;
    const title = current.titles.secondary || undefined;
    if (!title && !artist) {
      return {};
    }

    const cover = current.image_url
      ? current.image_url.replace('{recipe}', '640x640')
      : undefined;

    return {
      title,
      artist,
      cover,
    };
  }

}

module.exports = Bbc6MusicScraper;
