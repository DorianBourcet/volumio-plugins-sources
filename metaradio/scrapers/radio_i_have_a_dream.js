'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioIHaveADreamScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    var regex = /^-*([A-Z -.]+)-(.+)$/;
    var [info] = jp.query(metadata, '$.0.2');
    if (!info) {
      return {};
    }
    // No match at all is the common case for jingles and announcements: show the raw
    // line rather than throwing on a null match.
    var matches = info.match(regex);
    if (!matches) {
      return {
        title: info.trim() || undefined,
      };
    }
    return {
      artist: matches[1].trim() || undefined,
      title: matches[2].trim() || undefined,
    };
  }

}

module.exports = RadioIHaveADreamScraper;