'use strict';

const NovaBaseScraper = require('./nova_base');

class RadioNovaReggaeScraper extends NovaBaseScraper {

  get code() {
    return 'nova-reggae';
  }

}

module.exports = RadioNovaReggaeScraper;
