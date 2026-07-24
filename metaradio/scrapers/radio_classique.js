'use strict';

const BaseScraper = require('./base');

// The API returns HTML fragments; metaradio runs server-side (no DOMParser), so
// strip tags and decode the few entities that show up by regex.
function clean(value) {
  if (!value) {
    return undefined;
  }
  const text = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*:$/, '')
    .trim();
  return text || undefined;
}

class RadioClassiqueScraper extends BaseScraper {

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const title = clean(data.titre);
    const artist = clean(data.auteur);

    if (artist === ':-)') {
      return {};
    }

    if (!title && !artist) {
      return {};
    }

    return {
      title,
      artist,
    };
  }

}

module.exports = RadioClassiqueScraper;
