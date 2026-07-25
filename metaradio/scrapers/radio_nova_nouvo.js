'use strict';

const NovaBaseScraper = require('./nova_base');

class RadioNovaNouvoScraper extends NovaBaseScraper {

  get code() {
    return 'nouvo-nova';
  }

}

module.exports = RadioNovaNouvoScraper;
