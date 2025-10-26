'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class TsfJazzScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.current.title');
    const [artist] = jp.query(metadata, '$.current.artist');
    const [cover] = jp.query(metadata, '$.current.cover');
    const [startTime] = jp.query(metadata, '$.current.start_time');
    let [duration] = jp.query(metadata, '$.current.duration');
    duration = Math.ceil(duration);
    const endTime = startTime + duration;
    // var now = Math.floor(Date.now() / 1000);
    // if (now > endTime + 5) {
    //   return {};
    // }

    return {
      title,
      artist,
      cover,
      // startTime,
      // endTime
    };
  }
}

module.exports = TsfJazzScraper;