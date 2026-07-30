'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);

const NETWORK_ID = 16;
const STATION_ID = 111;

function buildCover(picture) {
  if (!picture || !picture.pattern) {
    return undefined;
  }
  return picture.pattern.replace('{width}', '400').replace('{ratio}', '1x1');
}

class RCIciMusiqueClassiqueScraper extends BaseScraper {

  // The GraphQL endpoint answers 400 to a header-less GET, calling it a potential CSRF;
  // any content-type outside the form/text-plain set satisfies it. Until base propagated
  // failures this surfaced as a permanently empty station rather than an error.
  _fetchMetadata(url, method) {
    return this._httpRequest(url, {
      method: method,
      headers: {'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json'},
    });
  }

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const schedules = data && data.data && data.data.liveSchedules
      ? data.data.liveSchedules.schedules || []
      : [];
    const schedule = schedules.find(function (item) {
      return item.broadcastingStationId === STATION_ID
        || (item.broadcastingNetwork && item.broadcastingNetwork.id === NETWORK_ID);
    });
    if (!schedule) { return {}; }

    let now = dayjs().unix();
    let inRange = function (start, end) {
      return dayjs(start).unix() <= now && dayjs(end).unix() > now;
    };

    let broadcast = (schedule.broadcasts || []).find(function (item) {
      return inRange(item.startTime, item.endTime);
    });
    if (!broadcast) { return {}; }

    // Program level (host show); overridden below by the current music track.
    let scraped = {
      title: broadcast.title,
      artist: broadcast.hosts,
      cover: buildCover(broadcast.picture),
      startTime: dayjs(broadcast.startTime).unix(),
      endTime: dayjs(broadcast.endTime).unix(),
    };

    let musics = broadcast.musics || [];
    let music = musics.find(function (item) {
      return inRange(item.startTime, item.endTime);
    });
    if (music) {
      // Classical channel: the composer is the meaningful "artist".
      scraped.title = music.title;
      scraped.artist = music.composers || music.artists;
      scraped.startTime = dayjs(music.startTime).unix();
      scraped.endTime = dayjs(music.endTime).unix();
    }

    // Refresh as soon as the next known track starts, if that comes sooner.
    let nextMusic = musics.find(function (item) {
      return dayjs(item.startTime).unix() >= now;
    });
    if (nextMusic) {
      scraped.endTime = Math.min(scraped.endTime, dayjs(nextMusic.startTime).unix());
    }

    return scraped;
  }

}

module.exports = RCIciMusiqueClassiqueScraper;
