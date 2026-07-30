'use strict';

const libQ = require('kew');
const http = require('https');
const debug = require('../helpers/debug');

const REQUEST_TIMEOUT_MS = 8000;

class BaseScraper {

  // Rejects on any transport or parsing failure: the controller turns that into the
  // station-name placeholder and applies its scraping backoff. Swallowing errors here
  // would keep that backoff from ever engaging.
  getMetadata(url, method) {
    const self = this;
    return this._fetchMetadata(url, method)
      .then(function (response) {
        return self._scrapeMetadata(response);
      });
  }

  _fetchMetadata(url, method) {
    // Some APIs (e.g. BBC/CloudFront) reject requests without a User-Agent with a 403.
    return this._httpRequest(url, {method: method, headers: {'User-Agent': 'Mozilla/5.0'}});
  }

  // Single place where HTTP is spoken. Subclasses that need a request body (POST APIs)
  // override _fetchMetadata and pass `body` rather than reimplementing this.
  _httpRequest(url, options) {
    var defer = libQ.defer();
    var settled = false;
    // Several of the paths below can fire for one request (timeout then close, ...), and
    // exactly one of them must win.
    var settle = function (isError, value) {
      if (settled) { return; }
      settled = true;
      if (isError) {
        defer.reject(value);
      } else {
        defer.resolve(value);
      }
    };

    var req = http.request(url, {method: options.method, headers: options.headers}, (resp) => {
      if (resp.statusCode < 200 || resp.statusCode > 299) {
        console.log('FAILED TO QUERY API', url);
        console.log('STATUS CODE', resp.statusCode);
        resp.resume();  // drain, else the socket stays pinned in the agent pool
        settle(true, new Error('Failed to query the api: HTTP ' + resp.statusCode));
        return;
      }
      let data = '';
      // Decode as UTF-8 across chunk boundaries: concatenating raw Buffers can split a
      // multi-byte sequence and mangle accented or non-latin titles.
      resp.setEncoding('utf8');
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        debug.debugLog('LA REPONSE', debug.truncate(data));
        settle(false, data);
      });
      // A mid-body failure surfaces here, not on the request.
      resp.on('error', (err) => {
        settle(true, err);
      });
      resp.on('aborted', () => {
        settle(true, new Error('Response aborted by the server'));
      });
    });

    // Without a timeout, a server that accepts the connection and never answers leaves
    // the promise pending forever, which freezes the polling loop.
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Timed out after ' + REQUEST_TIMEOUT_MS + 'ms'));
    });
    req.on('error', (err) => {
      settle(true, err);
    });
    // Last-resort guard: a premature socket close can emit neither 'end' nor 'error',
    // and 'close' always fires eventually.
    req.on('close', () => {
      settle(true, new Error('Connection closed before the response completed'));
    });

    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();

    return defer.promise;
  };

  _scrapeMetadata(response) {
    throw new Error('Method "_scrapeMetadata" must be implemented.');
  }
}

module.exports = BaseScraper;
