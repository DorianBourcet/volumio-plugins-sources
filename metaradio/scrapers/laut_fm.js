'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const jp = require('jsonpath');

dayjs.extend(utc);
dayjs.extend(timezone);

// dayjs(undefined) yields "now", so a missing timestamp would fabricate a startTime that
// slides forward on every poll; only accept a value that actually parses.
function toEpoch(value) {
  if (!value) {
    return undefined;
  }
  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.unix() : undefined;
}

class LautFmScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);

    const [title] = jp.query(metadata, '$.title');
    const [artist] = jp.query(metadata, '$.artist.name');

    if (!title && !artist) {
      return {};
    }

    const [startedAt] = jp.query(metadata, '$.started_at');
    const [endsAt] = jp.query(metadata, '$.ends_at');

    return {
      title: title || undefined,
      artist: artist || undefined,
      startTime: toEpoch(startedAt),
      endTime: toEpoch(endsAt),
    };
  }

}

module.exports = LautFmScraper;
