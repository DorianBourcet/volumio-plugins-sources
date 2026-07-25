'use strict';

const RadioFranceHighDefScraper = require('./radio_france_high_def');

const DIRECT_LABEL = RadioFranceHighDefScraper.DIRECT_LABEL;

// While FIP airs a show rather than a track, the fip_extended visual only reports
// "Le direct". The fip_player visual on the same station does expose the show, so
// fall back to it when the primary response carries no track.
class RadioFranceFipScraper extends RadioFranceHighDefScraper {

  _scrapeMetadata(response) {
    const track = super._scrapeMetadata(response);
    if (track && track.title) {
      return track;
    }

    const self = this;
    const fallbackUrl = String(this._url).replace(/\/fip_extended(\?|$)/, '/fip_player$1');
    return this._fetchMetadata(fallbackUrl, 'GET')
      .then(function (fallbackResponse) {
        return self._scrapeShow(fallbackResponse);
      });
  }

  _scrapeShow(response) {
    const now = JSON.parse(response).now || {};

    // On fip_player a track fills all three lines (station / title / artist). Only a
    // show leaves thirdLine empty; a track here would just duplicate fip_extended.
    if (now.thirdLine) {
      return {};
    }
    if (!now.firstLine || now.firstLine.trim() === DIRECT_LABEL) {
      return {};
    }

    // The API pads the show name with a trailing space, e.g. "Club Jazzafip ".
    const show = now.firstLine.trim();
    const episode = now.secondLine ? now.secondLine.trim() : '';

    const startTime = now.startTime ? now.startTime + 23 : undefined;
    const endTime = now.endTime ? now.endTime + 23 : undefined;

    return {
      title: episode || show,
      artist: episode ? show : undefined,
      cover: this._coverUrlFor(now.cover),
      startTime,
      endTime,
    };
  }

}

module.exports = RadioFranceFipScraper;
