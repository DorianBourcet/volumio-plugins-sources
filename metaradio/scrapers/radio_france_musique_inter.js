'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');

class RadioFranceMusiqueInterScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    const [title] = jp.query(metadata, '$.now.firstLine');
    if (title === 'Le direct') {
      return {};
    }
    const [artist] = jp.query(metadata, '$.now.secondLine');
    let [album] = jp.query(metadata, '$.now.song.title');
    const [year] = jp.query(metadata, '$.now.song.year');
    let [cover] = jp.query(metadata, '$.now.visual_cover_400x400.webpSrc');
    const [startTime] = jp.query(metadata, '$.now.startTime');
    const [endTime] = jp.query(metadata, '$.now.endTime');
    // let [delayToRefresh] = jp.query(metadata, '$.delayToRefresh');
    if (year) {
      album = album + ' (' + year + ')';
    }
    // if (delayToRefresh) {
    //   delayToRefresh = delayToRefresh / 1000 + 5;
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

module.exports = RadioFranceMusiqueInterScraper;