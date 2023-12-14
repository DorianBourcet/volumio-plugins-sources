'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RadioNovaScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.currentTrack.title');
    const [artist] = jp.query(metadata, '$.currentTrack.artist');
    const [cover] = jp.query(metadata, '$.currentTrack.image');
    const [diffusionDate] = jp.query(metadata, '$.currentTrack.diffusion_date');
    const [rawDuration] = jp.query(metadata, '$.currentTrack.duration');
    dayjs.extend(utc);
    dayjs.extend(timezone);
    const startTime = dayjs.tz(diffusionDate, 'Europe/Paris').unix();
    const [minutes,seconds] = rawDuration.split(':');
    const endTime = startTime + minutes * 60 + (+seconds);

    return {
      title,
      artist,
      cover,
      startTime,
      endTime,
    };
  }

}

module.exports = RadioNovaScraper;