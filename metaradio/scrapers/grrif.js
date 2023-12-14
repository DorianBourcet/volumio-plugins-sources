'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class GrrifScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response).reverse();
    const [title] = jp.query(metadata, '$.0.Title');
    const [artist] = jp.query(metadata, '$.0.Artist');
    const [cover] = jp.query(metadata, '$.0.URLCover');
    const [hours] = jp.query(metadata, '$.0.Hours');
    dayjs.extend(utc);
    dayjs.extend(timezone);
    const currentDateInSwitzerland = dayjs().tz('Europe/Zurich').format('YYYY-MM-DD');
    const estimatedStartTime = dayjs.tz(currentDateInSwitzerland+'T'+hours+':30', 'Europe/Zurich').unix();
    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.min(now,estimatedStartTime);

    return {
      title,
      artist,
      cover,
      startTime,
    };
  }

}

module.exports = GrrifScraper;