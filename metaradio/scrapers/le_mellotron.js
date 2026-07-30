'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');

class LeMellotronScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);

    if (!metadata.title) {
      return {};
    }

    return {
      title: metadata.title,
      artist: metadata.artist || undefined,
      album: metadata.album || undefined,
      cover: metadata.cover && !metadata.default_cover ? metadata.cover : undefined,
      startTime: this._toEpoch(metadata.started_at),
      endTime: this._toEpoch(metadata.end_at),
    };
  }

  _toEpoch(value) {
    const parsed = value ? dayjs(value) : null;

    return parsed && parsed.isValid() ? parsed.unix() : undefined;
  }

}

module.exports = LeMellotronScraper;
