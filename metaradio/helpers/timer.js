var debug = require('./debug');

// Delay applied when a tick fails, so a broken task retries instead of killing the loop.
var FALLBACK_DELAY = 30000;

function Timer(taskFn, delayFn, initialDelay) {
  var self = this;
  self.taskFn = taskFn;
  self.delayFn = delayFn;
  self.initialDelay = initialDelay;
  self.timeoutObj = null;
  self.latestDelay = initialDelay;
  self.stopped = true;
  self.fallbackDelay = FALLBACK_DELAY;

  self.start = function() {
    var self = this;
    // Idempotent on purpose: a second start() used to fork a parallel setTimeout chain
    // that stop() could no longer reach, permanently multiplying the polling rate.
    if (!self.stopped) { return; }
    self.stopped = false;
    self.schedule(self.latestDelay);
  }

  self.schedule = function(delay) {
    var self = this;
    clearTimeout(self.timeoutObj);
    self.timeoutObj = setTimeout(self.executeTask, delay);
  }

  self.executeTask = function() {
    var self = this;
    if (self.stopped) { return; }
    debug.debugLog('TIMER_TICK');

    // kew swallows unhandled rejections and a synchronous throw would escape into the
    // setTimeout callback: either way the loop would stop for good, without a trace.
    try {
      self.taskFn()
        .then(function(result) {
          if (self.stopped) { return; }
          self.latestDelay = self.delayFn(result);
          self.schedule(self.latestDelay);
        })
        .fail(function(e) {
          console.log('TIMER_TASK_FAILED', e && e.message ? e.message : e);
          if (self.stopped) { return; }
          self.schedule(self.fallbackDelay);
        });
    } catch (e) {
      console.log('TIMER_TASK_THREW', e && e.message ? e.message : e);
      self.schedule(self.fallbackDelay);
    }
  }

  self.stop = function() {
    var self = this;
    self.stopped = true;
    clearTimeout(self.timeoutObj);
    self.timeoutObj = null;
    self.latestDelay = self.initialDelay;
  }

  self.executeTask = self.executeTask.bind(self);
  self.start = self.start.bind(self);
  self.stop = self.stop.bind(self);
  self.schedule = self.schedule.bind(self);
}

module.exports = Timer;
