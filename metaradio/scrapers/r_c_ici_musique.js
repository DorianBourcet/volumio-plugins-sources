'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

class RCIciMusiqueScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const metadata = JSON.parse(response);
    let found = metadata.schedules.find(item => item.broadcastingNetworkId == 4 && item.broadcastingStationId == 5);
    if (!found) {return {};}
    dayjs.extend(utc);
    let now = dayjs().unix();
    if (!found.trafficBroadcasts) {return {};}
    let broadcast = found.trafficBroadcasts.find(function(item) {
      return dayjs(item.startsAt).unix() <= now && dayjs(item.endsAt).unix() > now;
    });
    if (!broadcast) {return {};}
    let program = {
      title: broadcast.title,
      artist: broadcast.credits,
      // A broadcast without a picture used to throw here, and base swallowed it, so the
      // station silently fell back to its own name although the title was available.
      cover: broadcast.picture && broadcast.picture.url
        ? broadcast.picture.url.replace('{1}','1x1').replace('{0}','400')
        : undefined,
      startTime: dayjs(broadcast.startsAt).unix(),
      endTime: dayjs(broadcast.endsAt).unix(),
    };
    let musicTracks = found.musicTracks || [];
    let broadcastTwo = musicTracks.find(function(item) {
      return dayjs(item.broadcastedAt).unix() <= now && dayjs(item.broadcastedLastTimeAt).unix() > now;
    });
    let musicTitle = {};
    if (broadcastTwo) {
      musicTitle = {
        title: broadcastTwo.title,
        artist: broadcastTwo.artists,
        startTime: dayjs(broadcastTwo.broadcastedAt).unix(),
        endTime: dayjs(broadcastTwo.broadcastedLastTimeAt).unix(),
      };
    }
    let broadcastThree = musicTracks.find(function(item) {
      return dayjs(item.broadcastedAt).unix() >= now;
    });
    let nextTitleStartTime = broadcastThree ? dayjs(broadcastThree.broadcastedAt).unix() : null;
    let endTime = nextTitleStartTime ? Math.min(program.endTime, nextTitleStartTime) : program.endTime;
    let scraped = {...program, ...musicTitle, endTime};
    return scraped;
  }

}

module.exports = RCIciMusiqueScraper;
