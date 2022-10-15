function Cache(maxTtl = 900) {
  var self = this;
  self.maxTtl = maxTtl;
  self.cache = {};
  self.refreshDelays = {};

  self.get = function(key) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    if (self.cache[key] === undefined) { return undefined;}
    if (self.cache[key].validUntil < now) {
      console.log('CACHE__EXPIRED_FROM_CACHE');
      delete self.cache[key];
      return undefined;
    } else {
      console.log('CACHE__FETCHED_FROM_CACHE');
    }
    console.log('CACHE_VALID_UNTIL '+self.cache[key].validUntil);
    return self.cache[key].value;
  }

  self.canRefresh = function(key) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    let refreshDelay = self.refreshDelays[key];
    console.log('REFRESH_DELAY '+refreshDelay);
    if (refreshDelay === undefined) { return true; }
    if (now > refreshDelay) {
      delete self.refreshDelays[key];
      return true
    }
    return false;
  }

  self.set = function(key, value, ttl, ttr = null) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    if (ttl > self.maxTtl) { ttl = maxTtl;}
    if (!ttr) { ttr = ttl;}
    let validUntil = now + ttl;
    let shouldNotRefreshUntil = now + ttr;
    console.log('CACHE__SET_CACHE '+key);
    self.cache = {...self.cache, ...{[key]: {value, validUntil}}};
    self.refreshDelays = {...self.refreshDelays, ...{[key]: shouldNotRefreshUntil}};
    console.log(JSON.stringify(self.cache));
  }
}

module.exports = Cache;