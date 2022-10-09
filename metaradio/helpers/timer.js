function Timer(taskFn, delayFn, initialDelay) {
  var self = this;
  self.taskFn = taskFn;
  self.delayFn = delayFn;
  self.initialDelay = initialDelay;
  self.timeoutObj = null;
  self.initialDelay = initialDelay;
  self.latestDelay = initialDelay;

  self.start = function() {
    var self = this;
    self.timeoutObj = setTimeout(
      self.executeTask,
      self.latestDelay
    );
  }

  self.executeTask = function() {
    var self = this;
    self.taskFn().then(function(result) {
      self.latestDelay = delayFn(result);
      self.timeoutObj = setTimeout(
        self.executeTask,
        self.latestDelay
      );
    });
  }


  self.stop = function() {
    var self = this;
    clearTimeout(self.timeoutObj);
    self.latestDelay = initialDelay;
  }

  self.executeTask = self.executeTask.bind(self);
  self.start = self.start.bind(self);
  self.stop = self.stop.bind(self);
}

module.exports = Timer;