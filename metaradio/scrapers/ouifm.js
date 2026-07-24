'use strict';

const BaseScraper = require('./base');

class OuiFmScraper extends BaseScraper {

  // The OUI FM API expects a `date=<now>` cache-buster; base.getMetadata uses the
  // static config URL, so append the timestamp here before delegating.
  getMetadata(url, method) {
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    return super.getMetadata(url + sep + 'date=' + Date.now(), method);
  }

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const entry = Array.isArray(data) ? data[0] : null;
    const current = entry && entry.title;

    if (!current || (!current.title && !current.artist)) {
      return {};
    }

    const startTime = entry.timestamp
      ? Math.floor(Date.parse(entry.timestamp) / 1000)
      : undefined;

    return {
      title: current.title || undefined,
      artist: current.artist || undefined,
      cover: current.coverUrl || undefined,
      startTime: Number.isFinite(startTime) ? startTime : undefined,
    };
  }

}

module.exports = OuiFmScraper;
