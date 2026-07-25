'use strict';

const BaseScraper = require('./base');

class ShonanBeachFmScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);

    // During spoken segments the track fields go empty; fall back to the show name.
    const title = data.title || data.program || undefined;

    if (title === undefined) {
      return {};
    }

    return {
      title,
      artist: data.aartist || undefined,
      cover: data.imagepath ? data.imagepath.replace(/^http:/, 'https:') : undefined,
      startTime: this._parseStartTime(data.datetime),
    };
  }

  // `datetime` is an Asia/Tokyo wall clock with no timezone marker, so the offset
  // has to be spelled out — parsing it as-is would use the Volumio box's timezone.
  _parseStartTime(datetime) {
    if (!datetime) {
      return undefined;
    }

    const startTime = Math.floor(Date.parse(datetime.replace(' ', 'T') + '+09:00') / 1000);
    const now = Math.floor(Date.now() / 1000);

    return Number.isFinite(startTime) && startTime <= now ? startTime : undefined;
  }

}

module.exports = ShonanBeachFmScraper;
