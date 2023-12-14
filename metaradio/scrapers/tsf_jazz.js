'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');

class TsfJazzScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.data.0.track.title');
    const [artist] = jp.query(metadata, '$.data.0.track.artist');
    const [cover] = jp.query(metadata, '$.data.0.track.thumbnail_medium');
    let [startTime] = jp.query(metadata, '$.data.0.datetime');
    const [duration] = jp.query(metadata, '$.data.0.track.duration');
    startTime = dayjs(startTime).unix();
    const endTime = startTime + duration;

    return {
      title,
      artist,
      cover,
      startTime,
      endTime
    };
  }

}

module.exports = TsfJazzScraper;