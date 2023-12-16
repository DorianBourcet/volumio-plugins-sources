'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.now.firstLine');
    const [artist] = jp.query(metadata, '$.now.secondLine');
    const [album] = jp.query(metadata, '$.now.song.release.title');
    let [cover] = jp.query(metadata, '$.now.cardVisual.webpSrc');
    const [startTime] = jp.query(metadata, '$.now.startTime');
    const [endTime] = jp.query(metadata, '$.now.endTime');
    let [delayToRefresh] = jp.query(metadata, '$.delayToRefresh');
    cover = cover.replace(/\/250x250_/,'/400x400_');
    delayToRefresh = delayToRefresh / 1000;

    if (title === 'Le direct') {
      return {};
    }

    return {
      title,
      artist,
      album,
      cover,
      startTime,
      endTime,
      delayToRefresh,
    };
  }

}

module.exports = RadioFranceScraper;