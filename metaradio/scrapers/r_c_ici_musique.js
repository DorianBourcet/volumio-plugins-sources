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
        var self = this;
        console.log('ALLO');
        let found = metadata.schedules.find(item => item.broadcastingNetworkId == 4 && item.broadcastingStationId == 83);
        if (!found) {console.log('ALLO2');return {};}
        console.log('ALLO3');
        //let program = self.findBroadcastingProgram(found.trafficBroadcasts);
        dayjs.extend(utc);
        console.log('ALLO3-00');
        let now = dayjs().unix();
        console.log('ALLO3-01');
        let broadcast = found.trafficBroadcasts.find(function(item) {
          console.log('HEY');
          return dayjs(item.startsAt).unix() <= now && dayjs(item.endsAt).unix() > now;
        });
        console.log('ALLO3-1');
        if (!broadcast) {return {};}
        let program = {
          title: broadcast.title,
          artist: broadcast.credits,
          cover: broadcast.picture.url.replace('{1}','1x1').replace('{0}','400'),
          startTime: dayjs(broadcast.startsAt).unix(),
          endTime: dayjs(broadcast.endsAt).unix(),
        };
        console.log(program);
        console.log('ALLO4');
        //let musicTitle = self.findBroadcastingTitle(found.musicTracks);
        let broadcastTwo = found.musicTracks.find(function(item) {
          return dayjs(item.broadcastedAt).unix() <= now && dayjs(item.broadcastedLastTimeAt).unix() > now;
        });
        console.log(broadcastTwo);
        let musicTitle = {};
        if (broadcastTwo) {
          musicTitle = {
            title: broadcastTwo.title,
            artist: broadcastTwo.artists,
            startTime: dayjs(broadcastTwo.broadcastedAt).unix(),
            endTime: dayjs(broadcastTwo.broadcastedLastTime).unix(),
          };
        }
        console.log(musicTitle)
        console.log('ALLO5');
        //let nextTitleStartTime = self.findNextBroadcastingStartTime(found.musicTracks);
        let broadcastThree = found.musicTracks.find(function(item) {
          return dayjs(item.broadcastedAt).unix() >= now;
        });
        let nextTitleStartTime = null;
        if (broadcastThree) {
          nextTitleStartTime = dayjs(broadcastThree.broadcastedAt).unix();
        }
        console.log(nextTitleStartTime);
        console.log('ALLO6');
        let scraped = {...program, ...musicTitle, ...{endTime : Math.min(program.endTime,nextTitleStartTime)}};
        console.log('ALLO7');
        console.log(scraped);
        return scraped;
      });
  }

  findBroadcastingProgram(broadcasts) {
    let now = dayjs().unix();
    let broadcast = broadcasts.find(function(item) {
      return dayjs(item.startsAt).unix() <= now && dayjs(item.endsAt).unix() > now;
    });
    if (!broadcast) {return {};}
    return {
      title: broadcast.title,
      artist: broadcast.credits,
      cover: broadcast.picture.url.replace('{1}','1x1').replace('{0}','400'),
      startTime: dayjs(broadcast.startsAt).unix(),
      endTime: dayjs(broadcast.endsAt).unix(),
    }
  }

  findBroadcastingTitle(broadcasts) {
    let now = dayjs().unix();
    let broadcast = broadcasts.find(function(item) {
      return dayjs(item.broadcastedAt).unix() <= now && dayjs(item.broadcastedLastTimeAt).unix() > now;
    });
    if (!broadcast) {return {};}
    return {
      title: broadcast.title,
      artist: broadcast.artists,
      startTime: dayjs(broadcast.broadcastedAt).unix(),
      endTime: dayjs(broadcast.broadcastedLastTime).unix(),
    };
  }

  findNextBroadcastingStartTime(broadcasts) {
    let now = dayjs().unix();
    let broadcast = broadcasts.find(function(item) {
      return dayjs(item.broadcastedAt).unix() >= now;
    });
    if (!broadcast) {return null;}
    return dayjs(broadcast.broadcastedAt).unix();
  }

}

module.exports = RCIciMusiqueScraper;