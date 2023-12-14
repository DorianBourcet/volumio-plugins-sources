'use strict';

const libQ = require('kew');
const http = require('https');

class BaseScraper {

  getMetadata(url) {
    const self = this;
    return this._fetchMetadata(url)
      .then(function (response) {
        console.log('RAW METADATA',response);
        return self._scrapeMetadata(response);
      });
  }

  _fetchMetadata(url) {
    var defer = libQ.defer();
    http.get(url, (resp) => {
      if (resp.statusCode < 200 || resp.statusCode > 299) {
        console.log('FAILED TO QUERY API',url);
        console.log('STATUS CODE',resp.statusCode);
          defer.reject(new Error('Failed to query the api'));
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
      defer.reject(err);
    });
    
    return defer.promise;
  };

  _scrapeMetadata(response) {
    throw new Error('Method "_scrapeMetadata" must be implemented.');
  }
}

module.exports = BaseScraper;