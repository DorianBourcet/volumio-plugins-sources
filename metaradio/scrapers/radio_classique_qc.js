'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

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