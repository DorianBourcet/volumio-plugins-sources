'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class KcrwScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.title');
        var [artist] = jp.query(metadata, '$.artist');
        var [album] = jp.query(metadata, '$.album');
        var [cover] = jp.query(metadata, '$.albumImageLarge');
        var [diffusionDate] = jp.query(metadata, '$.datetime');
        dayjs.extend(utc);
        dayjs.extend(timezone);
        var startTime = dayjs.tz(diffusionDate, 'America/Los_Angeles').unix();

        if (title === '[break]') {
          var now = Math.floor(Date.now() / 1000);
          return {
            startTime: now,
            endTime: now + 20,
          };
        }

        return {
          title,
          artist,
          album,
          cover,
          startTime,
        };
      });
  }

}

module.exports = KcrwScraper;