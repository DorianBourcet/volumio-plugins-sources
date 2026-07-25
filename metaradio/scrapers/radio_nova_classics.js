'use strict';

const NovaBaseScraper = require('./nova_base');

class RadioNovaClassicsScraper extends NovaBaseScraper {

  get code() {
    return 'nova-classics';
  }

}

module.exports = RadioNovaClassicsScraper;
