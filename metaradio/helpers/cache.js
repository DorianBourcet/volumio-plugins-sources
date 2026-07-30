var debug = require('./debug');

// Applied when a caller passes a non-finite ttl. A NaN ttl used to yield validUntil=NaN,
// and `NaN < now` being false the entry then never expired.
var DEFAULT_TTL = 60;

function Cache(maxTtl = 900) {
  var self = this;
  self.maxTtl = maxTtl;
  self.cache = {};

  self.get = function(key) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    if (self.cache[key] === undefined) { return undefined;}
    if (self.cache[key].validUntil < now) {
      debug.debugLog('CACHE__EXPIRED_FROM_CACHE ' + key);
      delete self.cache[key];
      return undefined;
    }
    return self.cache[key].value;
  }

  self.set = function(key, value, ttl) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ttl) || ttl <= 0) { ttl = DEFAULT_TTL;}
    if (ttl > self.maxTtl) { ttl = self.maxTtl;}
    // Entries only ever expired on a get() of their own key, so stations that are never
    // played again stayed resident for the lifetime of the process.
    self.prune(now);
    self.cache[key] = {value, validUntil: now + ttl};
    debug.debugLog('CACHE__SET_CACHE ' + key + ' (ttl ' + ttl + 's, ' + Object.keys(self.cache).length + ' entries)');
  }

  self.prune = function(now) {
    let self = this;
    for (let key in self.cache) {
      if (self.cache[key].validUntil < now) {
        delete self.cache[key];
      }
    }
  }

  self.clear = function() {
    let self = this;
    self.cache = {};
  }
}

module.exports = Cache;
