'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RadioClassiqueQcScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.artist');
    const [artist] = jp.query(metadata, '$.title');
    const [cover] = jp.query(metadata, '$.image');

    return {
      title,
      artist,
      cover
    };
  }

}

module.exports = RadioClassiqueQcScraper;