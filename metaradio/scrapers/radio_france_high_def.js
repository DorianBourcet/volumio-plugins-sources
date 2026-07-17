'use strict';

const BaseScraper = require('./base');

const DIRECT_LABEL = 'Le direct';
const SEPARATOR = ' • ';

// Radio France exposes covers as an image id resolved through the pikapi CDN.
function coverUrlFor(id) {
  return id ? 'https://www.radiofrance.fr/pikapi/images/' + id + '/800x800' : undefined;
}

// Musical webradios pack "Artist • Title" into a single line.
function splitArtistTitle(line) {
  const idx = line.indexOf(SEPARATOR);
  if (idx === -1) {
    return { title: line };
  }
  return {
    artist: line.slice(0, idx).trim() || undefined,
    title: line.slice(idx + SEPARATOR.length).trim() || undefined,
  };
}

class RadioFranceHighDefScraper extends BaseScraper {

  // The livemeta response shape depends on the "visual" (last URL segment), which
  // base.getMetadata does not forward to _scrapeMetadata, so capture it here.
  getMetadata(url, method) {
    this._visual = String(url).split('?')[0].split('/').pop();
    return super.getMetadata(url, method);
  }

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const now = data.now || {};
    const visual = this._visual || 'fip_extended';

    let core;
    if (visual === 'fip_extended') {
      if (!now.title || now.title === DIRECT_LABEL) {
        return {};
      }
      core = {
        title: now.title || undefined,
        artist: now.interpreters || undefined,
        album: now.album || undefined,
      };
    } else if (visual === 'transistor_musical_player') {
      // A real track always carries the "Artist • Title" separator; anything else
      // (e.g. the webradio tagline while idle) is not a song.
      if (!now.secondLine || now.secondLine.indexOf(SEPARATOR) === -1) {
        return {};
      }
      core = splitArtistTitle(now.secondLine);
    } else {
      // musique_player, transistor_inter_player, transistor_culture_player
      if (!now.secondLine || now.secondLine === DIRECT_LABEL || now.firstLine === DIRECT_LABEL) {
        return {};
      }
      core = {
        title: now.secondLine || undefined,
        artist: now.firstLine || undefined,
      };
    }

    const startTime = now.startTime ? now.startTime + 35 : undefined;
    const endTime = now.endTime ? now.endTime + 35 : undefined;

    return {
      ...core,
      cover: coverUrlFor(now.cover),
      startTime,
      endTime,
    };
  }

}

module.exports = RadioFranceHighDefScraper;
