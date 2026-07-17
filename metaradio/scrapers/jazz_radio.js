'use strict';

const libQ = require('kew');
const https = require('https');
const BaseScraper = require('./base');

const RADIO_ID = '1';

class JazzRadioScraper extends BaseScraper {

  _fetchMetadata(url, method) {
    const defer = libQ.defer();
    const body = JSON.stringify({ radio_ids: [RADIO_ID] });
    const req = https.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (resp) => {
      if (resp.statusCode < 200 || resp.statusCode > 299) {
        console.log('FAILED TO QUERY API', url);
        console.log('STATUS CODE', resp.statusCode);
        defer.reject(new Error('Failed to query the api'));
      } else {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { defer.resolve(data); });
      }
    });
    req.on('error', (err) => { defer.reject(err); });
    req.write(body);
    req.end();
    return defer.promise;
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
