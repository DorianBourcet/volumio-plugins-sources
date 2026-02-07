'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const jp = require('jsonpath');

class LautFmScraper extends BaseScraper {

  _scrapeMetadata(response) {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    
    const metadata = JSON.parse(response);
    
    const [title] = jp.query(metadata, '$.title');
    const [artist] = jp.query(metadata, '$.artist.name');
    
    let [startTime] = jp.query(metadata, '$.started_at');
    startTime = dayjs(startTime).unix();
    
    let [endTime] = jp.query(metadata, '$.ends_at');
    endTime = dayjs(endTime).unix();

    return {
      title,
      artist,
      startTime,
      endTime,
    };
  }

}

module.exports = LautFmScraper;