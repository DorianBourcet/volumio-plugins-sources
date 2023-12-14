'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class KcrwScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.title');
    const [artist] = jp.query(metadata, '$.artist');
    const [album] = jp.query(metadata, '$.album');
    const [cover] = jp.query(metadata, '$.albumImageLarge');
    const [diffusionDate] = jp.query(metadata, '$.datetime');
    dayjs.extend(utc);
    dayjs.extend(timezone);
    const startTime = dayjs(diffusionDate).unix();

    if (title.trim().toLowerCase() === '[break]') {
      return {};
    }

    return {
      title,
      artist,
      album,
      cover,
      startTime,
    };
  }

}

module.exports = KcrwScraper;