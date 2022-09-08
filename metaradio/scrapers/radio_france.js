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
        var [title] = jp.query(metadata, '$.now.firstLine.title');
        var [artist] = jp.query(metadata, '$.now.secondLine.title');
        var [album] = jp.query(metadata, '$.now.song.release.title');
        var [cover] = jp.query(metadata, '$.now.visuals.card.webpSrc');
        var [startTime] = jp.query(metadata, '$.now.startTime');
        var [endTime] = jp.query(metadata, '$.now.endTime');

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