'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RadioNovaSoulScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$[3].currentTrack.title');
    const [artist] = jp.query(metadata, '$[3].currentTrack.artist');
    const [cover] = jp.query(metadata, '$[3].currentTrack.image');
    const [diffusionDate] = jp.query(metadata, '$[3].currentTrack.diffusion_date');
    const [rawDuration] = jp.query(metadata, '$[3].currentTrack.duration');
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

module.exports = RadioNovaSoulScraper;