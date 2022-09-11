'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.now.firstLine');
        var [artist] = jp.query(metadata, '$.now.secondLine');
        var [album] = jp.query(metadata, '$.now.song.release.title');
        var [cover] = jp.query(metadata, '$.now.cover.webpSrc');
        var [startTime] = jp.query(metadata, '$.media.startTime');
        var [endTime] = jp.query(metadata, '$.media.endTime');

        return {
          title,
          artist,
          album,
          cover,
          startTime,
          endTime,
        };
      });
  }

}

module.exports = RadioFranceScraper;