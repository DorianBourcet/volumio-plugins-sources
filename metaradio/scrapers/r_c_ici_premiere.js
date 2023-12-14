'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RCIciPremiereScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    let found = metadata.schedules.find(item => item.broadcastingNetworkId == 3 && item.broadcastingStationId == 41);
    if (!found) {return {};}
    dayjs.extend(utc);
    let now = dayjs().unix();
    if (!found.trafficBroadcasts) {return {};}
    let broadcast = found.trafficBroadcasts.find(function(item) {
      return dayjs(item.startsAt).unix() <= now && dayjs(item.endsAt).unix() > now;
    });
    if (!broadcast) {return {};}
    var [title] = jp.query(broadcast, '$.title');
    var [artist] = jp.query(broadcast, '$.credits');
    var [cover] = jp.query(broadcast, '$.picture.url');
    cover = cover.replace('{1}','1x1').replace('{0}','400');
    var [startTime] = jp.query(broadcast, '$.startsAt');
    startTime = dayjs(startTime).unix();
    var [endTime] = jp.query(broadcast, '$.endsAt');
    endTime = dayjs(endTime).unix();
    return {
      title,
      artist,
      cover,
      startTime,
      endTime,
    };
  }

}

module.exports = RCIciPremiereScraper;