'use strict';

const libQ = require('kew');
const http = require('https');

class BaseScraper {

  getMetadata(url, method) {
    const self = this;
    return this._fetchMetadata(url, method)
      .then(function (response) {
        console.log('RAW METADATA',response);
        return self._scrapeMetadata(response);
      })
      .fail(function () {
        return {};
      });
  }

  _fetchMetadata(url, method) {
    var defer = libQ.defer();
    // Some APIs (e.g. BBC/CloudFront) reject requests without a User-Agent with a 403.
    var headers = {'User-Agent': 'Mozilla/5.0'};
    http.request(url, {method, headers}, (resp) => {
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
          console.log('LA REPONSE',data)
          defer.resolve(data);
        });
      }
    }).on("error", (err) => {
      defer.reject(err);
    }).end();
    
    return defer.promise;
  };

  _scrapeMetadata(response) {
    throw new Error('Method "_scrapeMetadata" must be implemented.');
  }
}

module.exports = BaseScraper;