'use strict';

const libQ = require('kew');
const http = require('https');
const jp = require('jsonpath');

class GrrifScraper {

    _fetchMetadata(pluginContext, url) {
        var defer = libQ.defer();    
        
        http.get(url, (resp) => {
            if (resp.statusCode < 200 || resp.statusCode > 299) {
                throw new Error('Failed to query the api');
            } else {
                pluginContext.logger.verbose('GRRIF_URL '+url);
                let data = '';
        
                // A chunk of data has been received.
                resp.on('data', (chunk) => {
                    data += chunk;
                });
        
                // The whole response has been received.
                resp.on('end', () => {
                    pluginContext.logger.verbose('GRRIF_RESPONSE' + data);
                    defer.resolve(data);
                });
            }
    
        }).on("error", (err) => {
            throw new Error('Failed to query the api');
        });
        
        return defer.promise;
    };

    getMetadata(pluginContext, url) {
        pluginContext.logger.verbose('HELLOOOW');
        return this._fetchMetadata(pluginContext, url)
        .then(function (eventResponse) {
            if (eventResponse !== null) {
                return JSON.parse(eventResponse);
            }
        })
        .then(function (metadata) {
            var [title] = jp.query(metadata, '$.[-1:].Title');
            var [artist] = jp.query(metadata, '$.[-1:].Artist');
            var [cover] = jp.query(metadata, '$.[-1:].URLCover');

            return {
                title,
                artist,
                cover,
            };
        })
    }

}

module.exports = GrrifScraper;