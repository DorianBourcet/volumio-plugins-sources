'use strict';

const libQ = require('kew');
const http = require('https');

class BaseScraper {

  _fetchMetadata(url) {
    var defer = libQ.defer();
    http.get(url, (resp) => {
      if (resp.statusCode < 200 || resp.statusCode > 299) {
          throw new Error('Failed to query the api');
      } else {
        let data = '';
        // A chunk of data has been received.
        resp.on('data', (chunk) => {
          data += chunk;
        });
        // The whole response has been received.
        resp.on('end', () => {
          defer.resolve(data);
        });
      }
    }).on("error", (err) => {
      throw new Error('Failed to query the api');
    });
    
    return defer.promise;
  };

  getMetadata(url) {
    throw new Error('Method "getMetadata" must be implemented.');
  }
}

module.exports = BaseScraper;