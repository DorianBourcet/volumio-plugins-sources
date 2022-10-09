function Cache(maxTtl = 900) {
  var self = this;
  self.maxTtl = maxTtl;
  self.cache = {};
  console.log('INSTANCIATED_CACHE');

  self.get = function(key) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    if (self.cache[key] === undefined) { return undefined;}
    if (self.cache[key].validUntil < now) {
      console.log('CACHE__EXPIRED_FROM_CACHE');
      delete self.cache[key];
      return undefined;
    }
    return self.cache[key].value;
  }

  self.set = function(key, value, ttl) {
    let self = this;
    let now = Math.floor(Date.now() / 1000);
    if (ttl > self.maxTtl) { ttl = maxTtl;}
    let validUntil = now + ttl;
    console.log('CACHE__SET_CACHE '+key);
    self.cache = {...self.cache, ...{[key]: {value, validUntil}}};
    console.log(JSON.stringify(self.cache));
  }
}

module.exports = Cache;