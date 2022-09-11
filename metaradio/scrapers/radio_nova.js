'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RadioNovaScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.currentTrack.title');
        var [artist] = jp.query(metadata, '$.currentTrack.artist');
        var [cover] = jp.query(metadata, '$.currentTrack.image');
        var [diffusionDate] = jp.query(metadata, '$.currentTrack.diffusion_date');
        var [rawDuration] = jp.query(metadata, '$.currentTrack.duration');
        dayjs.extend(utc);
        dayjs.extend(timezone);
        var startTime = dayjs.tz(diffusionDate, 'Europe/Paris').unix();
        var [minutes,seconds] = rawDuration.split(':');
        var endTime = startTime + minutes * 60 + (+seconds);

        return {
          title,
          artist,
          cover,
          startTime,
          endTime,
        };
      });
  }

}

module.exports = RadioNovaScraper;