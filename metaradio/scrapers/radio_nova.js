'use strict';

const NovaBaseScraper = require('./nova_base');

class RadioNovaScraper extends NovaBaseScraper {

  get code() {
    return 'radio-nova';
  }

}

module.exports = RadioNovaScraper;
