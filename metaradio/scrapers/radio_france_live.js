'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceLiveScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.now.secondLine.title');
    const [artist] = jp.query(metadata, '$.now.firstLine.title');
    let [cover] = jp.query(metadata, '$.now.visuals.player.webpSrc');
    const [startTime] = jp.query(metadata, '$.now.media.startTime');
    const [endTime] = jp.query(metadata, '$.now.media.endTime');

    cover = cover.replace(/\/200x200_/,'/400x400_');

    return {
      title,
      artist,
      cover,
      startTime,
      endTime,
    };
  }

}

module.exports = RadioFranceLiveScraper;