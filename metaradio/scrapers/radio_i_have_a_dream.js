'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioIHaveADreamScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        var regex = /^-*([A-Z -.]+)-(.+)$/;
        var [info] = jp.query(metadata, '$.0.2');
        var matches = info.match(regex);
        if (matches.length === 3) {
          var [artist,title] = [matches[1],matches[2]];
        } else {
          var [title,artist] = [matches[0]];
        }
        return {
          title,
          artist,
        };
      });
  }

}

module.exports = RadioIHaveADreamScraper;