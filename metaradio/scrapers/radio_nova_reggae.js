'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RadioNovaReggaeScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$[2].currentTrack.title');
    const [artist] = jp.query(metadata, '$[2].currentTrack.artist');
    const [cover] = jp.query(metadata, '$[2].currentTrack.image');
    const [diffusionDate] = jp.query(metadata, '$[2].currentTrack.diffusion_date');
    const [rawDuration] = jp.query(metadata, '$[2].currentTrack.duration');
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

module.exports = RadioNovaReggaeScraper;