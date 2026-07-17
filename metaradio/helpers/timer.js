function Timer(taskFn, delayFn, initialDelay) {
  var self = this;
  self.taskFn = taskFn;
  self.delayFn = delayFn;
  self.initialDelay = initialDelay;
  self.timeoutObj = null;
  self.initialDelay = initialDelay;
  self.latestDelay = initialDelay;
  self.stopped = true;

  self.start = function() {
    var self = this;
    self.stopped = false;
    self.timeoutObj = setTimeout(
      self.executeTask,
      self.latestDelay
    );
  }

  self.executeTask = function() {
    var self = this;
    if (self.stopped) { return; }
    console.log('TIMER_TICK');
    self.taskFn().then(function(result) {
      if (self.stopped) { return; }  // neutralise un scraping en vol arrivé après stop()
      self.latestDelay = delayFn(result);
      self.timeoutObj = setTimeout(
        self.executeTask,
        self.latestDelay
      );
    });
  }


  self.stop = function() {
    var self = this;
    self.stopped = true;
    clearTimeout(self.timeoutObj);
    self.latestDelay = initialDelay;
  }

  self.executeTask = self.executeTask.bind(self);
  self.start = self.start.bind(self);
  self.stop = self.stop.bind(self);
}

module.exports = Timer;