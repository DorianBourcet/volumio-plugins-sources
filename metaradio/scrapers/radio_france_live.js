'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceLiveScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.now.secondLine.title');
    if (title === 'Le direct') {
      return {};
    }
    const [artist] = jp.query(metadata, '$.now.firstLine.title');
    let [cover] = jp.query(metadata, '$.now.visuals.player.webpSrc');
    const [startTime] = jp.query(metadata, '$.now.media.startTime');
    const [endTime] = jp.query(metadata, '$.now.media.endTime');
    let [delayToRefresh] = jp.query(metadata, '$.delayToRefresh');
    if (delayToRefresh) {
      delayToRefresh = delayToRefresh / 1000;
    }
    if (cover) {
      cover = cover.replace(/\/200x200_/,'/400x400_');
    }

    return {
      title,
      artist,
      cover,
      startTime,
      endTime,
      delayToRefresh,
    };
  }

}

module.exports = RadioFranceLiveScraper;