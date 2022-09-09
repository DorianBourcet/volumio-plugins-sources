'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')

class GrrifScraper extends BaseScraper {

  /*construct() {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    super();
  }*/

  getMetadata(pluginContext, url) {
    return this._fetchMetadata(pluginContext, url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse).reverse();
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.0.Title');
        var [artist] = jp.query(metadata, '$.0.Artist');
        var [cover] = jp.query(metadata, '$.0.URLCover');
        var [hours] = jp.query(metadata, '$.0.Hours');
        dayjs.extend(utc);
        dayjs.extend(timezone);
        var currentDateInSwitzerland = dayjs().tz('Europe/Zurich').format('YYYY-MM-DD');
        var estimatedStartTime = dayjs.tz(currentDateInSwitzerland+'T'+hours+':30', 'Europe/Zurich').unix();
        var now = Math.floor(Date.now() / 1000);
        var startTime = Math.min(now,estimatedStartTime);

        return {
          title,
          artist,
          cover,
          startTime,
        };
      });
  }

}

module.exports = GrrifScraper;