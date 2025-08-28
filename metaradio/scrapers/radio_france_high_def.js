'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceHighDefScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.now.firstLine.title');
    if (title === 'Le direct') {
      return {};
    }
    const [artist] = jp.query(metadata, '$.now.secondLine.title');
    let [album] = jp.query(metadata, '$.now.song.release.title');
    const [year] = jp.query(metadata, '$.now.song.year');
    let [cover] = jp.query(metadata, '$.now.visuals.card.src');
    let [startTime] = jp.query(metadata, '$.now.startTime');
    let [endTime] = jp.query(metadata, '$.now.endTime');
    let [delayToRefresh] = jp.query(metadata, '$.delayToRefresh');
    if (cover) {
      cover = cover + '/800x800';
    }
    if (startTime) {
      startTime = startTime + 7;
    }
    if (endTime) {
      endTime = endTime + 7;
    }
    if (year) {
      album = album + ' (' + year + ')';
    }
    // if (delayToRefresh) {
    //   delayToRefresh = delayToRefresh / 1000;
    // }

    return {
      title,
      artist,
      album,
      cover,
      startTime,
      endTime,
      // delayToRefresh,
    };
  }

}

module.exports = RadioFranceHighDefScraper;