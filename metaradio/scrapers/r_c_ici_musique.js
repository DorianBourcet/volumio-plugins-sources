'use strict';

const jp = require('jsonpath');
const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

class RCIciMusiqueScraper extends BaseScraper {

  getMetadata(url) {
    return this._fetchMetadata(url)
      .then(function (eventResponse) {
        if (eventResponse !== null) {
          return JSON.parse(eventResponse);
        }
      })
      .then(function (metadata) {
        let found = metadata.schedules.find(item => item.broadcastingNetworkId == 4 && item.broadcastingStationId == 83);
        if (!found) {return {};}
        dayjs.extend(utc);
        let now = dayjs().unix();
        if (found.musicTracks) {
          let broadcastingTitle = this.findBroadcastingTitle(found.musicTracks);
        }
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
      });
  }

  findBroadcastingTitle(broadcasts) {
    let now = dayjs().unix();
    let broadcast = broadcasts.find(function(item) {
      return dayjs(item.broadcastedAt).unix() <= now && dayjs(item.broadcastedLastTimeAt).unix() > now;
    });
    if (!broadcast) {return {};}
    return broadcast;
  }

  findNextBroadcastingTitle(broadcasts) {
    let now = dayjs().unix();
    let broadcast = broadcasts.find(function(item) {
      return dayjs(item.broadcastedAt).unix() >= now;
    });
    if (!broadcast) {return {};}
    return broadcast;
  }

}

module.exports = RCIciMusiqueScraper;