'use strict';

const BaseScraper = require('./base');

const RADIO_ID = '1';

class JazzRadioScraper extends BaseScraper {

  // The API is a POST that selects the station through its body; everything else about
  // the request (timeout, draining, error handling) comes from base._httpRequest.
  _fetchMetadata(url, method) {
    const body = JSON.stringify({ radio_ids: [RADIO_ID] });
    return this._httpRequest(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      body: body,
    });
  }

  _scrapeMetadata(response) {
    const data = JSON.parse(response);
    const entry = data[RADIO_ID];
    if (!entry || (!entry.title && !entry.artist)) {
      return {};
    }
    return {
      title: entry.title || undefined,
      artist: entry.artist || undefined,
      cover: entry.cover || undefined,
    };
  }

}

module.exports = JazzRadioScraper;
