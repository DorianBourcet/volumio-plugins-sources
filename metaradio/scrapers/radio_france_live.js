'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceLiveScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.now.secondLine.title');
        var [artist] = jp.query(metadata, '$.now.firstLine.title');
        var [cover] = jp.query(metadata, '$.now.visuals.card.webpSrc');
        var [startTime] = jp.query(metadata, '$.now.media.startTime');
        var [endTime] = jp.query(metadata, '$.now.media.endTime');
        var [rawDelayToRefresh] = jp.query(metadata, '$.delayToRefresh');

        let scraped = {
          title,
          artist,
          cover,
          startTime,
          endTime,
        };
        if (rawDelayToRefresh !== null) {
          scraped.delayToRefresh = Math.floor(rawDelayToRefresh / 1000);
        }

        return scraped;
      });
  }

}

module.exports = RadioFranceLiveScraper;