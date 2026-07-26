'use strict';

const BaseScraper = require('./base');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const ZONE = 'America/Chicago';

function decodeEntities(str) {
  if (!str) {
    return str;
  }
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function firstMatch(html, regex) {
  const m = html.match(regex);
  return m ? decodeEntities(m[1]) : undefined;
}

class WdcbScraper extends BaseScraper {

  _scrapeMetadata(html) {
    const onAir = html.match(/<div class="playlist-block onair">[\s\S]*?<\/table>/);
    if (!onAir) {
      return {};
    }

    const showTitle = firstMatch(onAir[0], /<h3 class="show-title">\s*<a[^>]*>([\s\S]*?)<\/a>/);

    const spinRow = onAir[0].match(/<tr[^>]*class="spin-item"[^>]*data-spin="([^"]*)"[\s\S]*?<\/tr>/);
    if (!spinRow) {
      return showTitle ? {title: showTitle} : {};
    }

    let spin;
    try {
      spin = JSON.parse(decodeEntities(spinRow[1]));
    } catch (e) {
      return showTitle ? {title: showTitle} : {};
    }

    if (!spin.s && !spin.a) {
      return showTitle ? {title: showTitle} : {};
    }

    return {
      title: spin.s || undefined,
      artist: spin.a || undefined,
      album: spin.r || undefined,
      cover: firstMatch(spinRow[0], /<td class="spin-art">[\s\S]*?<img[^>]*src="([^"]*)"/),
      startTime: this._parseStartTime(firstMatch(spinRow[0], /<td class="spin-time">[\s\S]*?>(\d{1,2}:\d{2}\s*[AP]M)/)),
    };
  }

  _parseStartTime(spinTime) {
    if (!spinTime) {
      return undefined;
    }

    const today = dayjs().tz(ZONE).format('YYYY-MM-DD');
    let start = dayjs.tz(today + ' ' + spinTime.replace(/\s+/, ' '), 'YYYY-MM-DD h:mm A', ZONE);
    if (!start.isValid()) {
      return undefined;
    }

    const now = Math.floor(Date.now() / 1000);
    if (start.unix() > now) {
      start = start.subtract(1, 'day');
    }

    return start.unix() <= now ? start.unix() : undefined;
  }

}

module.exports = WdcbScraper;
