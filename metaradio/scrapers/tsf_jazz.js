'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');

class TsfJazzScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.data.0.track.title');
        var [artist] = jp.query(metadata, '$.data.0.track.artist');
        var [cover] = jp.query(metadata, '$.data.0.track.thumbnail_medium');
        var [startTime] = jp.query(metadata, '$.data.0.datetime');
        var [duration] = jp.query(metadata, '$.data.0.track.duration');
        startTime = dayjs(startTime).unix();
        var endTime = startTime + duration;

        return {
          title,
          artist,
          cover,
          startTime,
          endTime
        };
      });
  }

}

module.exports = TsfJazzScraper;