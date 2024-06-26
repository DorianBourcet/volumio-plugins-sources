'use strict';

const libQ = require('kew');
const http = require('https');
const jp = require('jsonpath');

class FipScraper {

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
        this._fetchMetadata(url)
        .then(function (eventResponse) {
            if (eventResponse !== null) {
                return JSON.parse(eventResponse);
            }
        })
        .then(function (metadata) {
            var title = jp.query(metadata, '$.now.firstLine.title');
            var artist = jp.query(metadata, '$.now.secondLine.title');
            var album = jp.query(metadata, '$.now.song.release.title');
            var cover = jp.query(metadata, '$.now.secondLine.visuals.card.webpSrc');

            return {
                title,
                artist,
                album,
                cover,
            };
        })
    }

}

module.exports = FipScraper;