'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioIHaveADreamScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    var regex = /^-*([A-Z -.]+)-(.+)$/;
    var [info] = jp.query(metadata, '$.0.2');
    var matches = info.match(regex);
    if (matches.length === 3) {
      return {
        artist: matches[1],
        title: matches[2],
      };
    }
    return {
      title: matches[0],
    };
  }

}

module.exports = RadioIHaveADreamScraper;