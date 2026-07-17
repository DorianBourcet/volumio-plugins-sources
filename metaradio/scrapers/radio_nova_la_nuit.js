'use strict';

const NovaBaseScraper = require('./nova_base');

class RadioNovaLaNuitScraper extends NovaBaseScraper {

  get code() {
    return 'nova-lanuit';
  }

}

module.exports = RadioNovaLaNuitScraper;
