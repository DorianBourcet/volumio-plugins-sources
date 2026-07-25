'use strict';

const NovaBaseScraper = require('./nova_base');

class RadioNovaSoulScraper extends NovaBaseScraper {

  get code() {
    return 'nova-soul';
  }

}

module.exports = RadioNovaSoulScraper;
