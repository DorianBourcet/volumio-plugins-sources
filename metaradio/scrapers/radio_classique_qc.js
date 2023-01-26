'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RadioClassiqueQcScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var [title] = jp.query(metadata, '$.artist');
        var [artist] = jp.query(metadata, '$.title');
        var [cover] = jp.query(metadata, '$.image');

        return {
          title,
          artist,
          cover
        };
      });
  }

}

module.exports = RadioClassiqueQcScraper;