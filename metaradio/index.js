'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

module.exports = ControllerMetaradio;

function ControllerMetaradio(context) {
	var self = this;

	self.context = context;
	self.commandRouter = this.context.coreCommand;
	self.logger = this.context.logger;
	self.configManager = this.context.configManager;
	self.name = 'Metaradio';
	self.serviceName = 'metaradio';
	self.state = {};
	self.timer = null;
	self.scraper = null;
}

ControllerMetaradio.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');

	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);

  return libQ.resolve();
}

ControllerMetaradio.prototype.onStart = function() {
  var self = this;
	var defer=libQ.defer();

	self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service','mpd');

	self.loadRadioI18nStrings();
	self.addToBrowseSources();
	self.addRadioResource();

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

  return defer.promise;
};

ControllerMetaradio.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

ControllerMetaradio.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

ControllerMetaradio.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');
		console.log('WOW language is '+lang_code);

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {


            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerMetaradio.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

ControllerMetaradio.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerMetaradio.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerMetaradio.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


ControllerMetaradio.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
	var self = this;
  var data = {name: self.name, uri: self.serviceName, plugin_type: 'music_service', plugin_name: self.serviceName};

  this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerMetaradio.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response;

		if (curUri.startsWith(self.serviceName)) {
			response = self.getRadioContent();
		}

    return response
			.fail(function (e) {
				self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] handleBrowseUri failed');
				libQ.reject(new Error());
		});
};



// Define a method to clear, add, and play an array of tracks
ControllerMetaradio.prototype.clearAddPlayTrack = function(track) {
	var self = this;

	if (self.timer) {
		self.timer.clear();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::clearAddPlayTrack');
	self.commandRouter.logger.info(JSON.stringify(track));

	return self.mpdPlugin.sendMpdCommand('stop', [])
		.then(function () {
			return self.mpdPlugin.sendMpdCommand('clear', []);
		})
		.then(function () {
			return self.mpdPlugin.sendMpdCommand('consume 1', []);
		})
		.then(function () {
			return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
		})
		.then(function () {
			//self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

			return self.mpdPlugin.sendMpdCommand('play', []);
		})
		.then(function () {
			self.scraper = new (require(__dirname + '/scrapers/' + track.scraper))();
			return self.setMetadata(track.api);
		})
		.fail(function (e) {
			return libQ.reject(new Error());
		});
};

ControllerMetaradio.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::seek to ' + timepos);

    return libQ.resolve();
};

// Stop
ControllerMetaradio.prototype.stop = function() {
	var self = this;

	if (self.timer) {
		self.timer.clear();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::stop');

	return self.mpdPlugin.sendMpdCommand('stop', [])
		.then(function () {
			self.state.status = 'stop';
			self.commandRouter.servicePushState(self.state, self.serviceName);
		});
};

// Pause
ControllerMetaradio.prototype.pause = function() {
	var self = this;

	if (self.timer) {
		self.timer.clear();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::pause');
	return self.mpdPlugin.sendMpdCommand('pause', [1])
    .then(function () {
        var vState = self.commandRouter.stateMachine.getState();
        self.state.status = 'pause';
        self.state.seek = vState.seek;
        self.commandRouter.servicePushState(self.state, self.serviceName);
    });
};

// Resume
ControllerMetaradio.prototype.resume = function () {
	var self = this;

	return self.mpdPlugin.sendMpdCommand('play', [])
		.then(function () {
			// adapt play status and update state machine
			self.state.status = 'play';
			self.commandRouter.servicePushState(self.state, self.serviceName);
		});
};


// Get state
ControllerMetaradio.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::getState');


};

//Parse state
ControllerMetaradio.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
ControllerMetaradio.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::pushState');

	return self.commandRouter.servicePushState(state, self.serviceName);
};


ControllerMetaradio.prototype.explodeUri = function(uri) {
	// Mandatory: retrieve all info for a given URI
	var self = this;
	var defer = libQ.defer();
	var response = [];
	var uris = uri.split('/');
	var channel = parseInt(uris[1]);
	var station = uris[0].substring(3);

	if (self.timer) {
		self.timer.clear();
	}
	response.push({
		service: self.serviceName,
		type: 'track',
		albumart: '/albumart?sourceicon=music_service/'+self.serviceName+'/logos/'+self.radioStations[station][channel].logo,
		uri: self.radioStations[station][channel].url,
		name: self.radioStations[station][channel].title,
		api: self.radioStations[station][channel].api,
		scraper: self.radioStations[station][channel].scraper
	});
	defer.resolve(response);

	return defer.promise;
};




ControllerMetaradio.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

ControllerMetaradio.prototype._searchArtists = function (results) {

};

ControllerMetaradio.prototype._searchAlbums = function (results) {

};

ControllerMetaradio.prototype._searchPlaylists = function (results) {


};

ControllerMetaradio.prototype._searchTracks = function (results) {

};

ControllerMetaradio.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};

ControllerMetaradio.prototype.addRadioResource = function() {
	var self = this;
	var radioResource = fs.readJsonSync(__dirname+'/radio_stations.json');
	var baseNavigation = radioResource.baseNavigation;

	self.radioStations = radioResource.stations;
	self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
};

ControllerMetaradio.prototype.getRadioContent = function() {
  var self = this;
  var response;

  response = self.rootNavigation;
  response.navigation.lists[0].items = [];
	for (var station in self.radioStations) {
		for (var channel of self.radioStations[station]) {
				var radio = {
					service: self.serviceName,
					type: 'song',
					title: channel.title,
					uri: channel.uri,
					albumart: '/albumart?sourceicon=music_service/'+self.serviceName+'/logos/'+channel.logo
				};
				response.navigation.lists[0].items.push(radio);
		}
	}

  return libQ.resolve(response);
};

ControllerMetaradio.prototype.loadRadioI18nStrings = function () {
	var self = this;
	self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
	self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

ControllerMetaradio.prototype.getRadioI18nString = function (key) {
	var self = this;

	if (self.i18nStrings[key] !== undefined)
			return self.i18nStrings[key];
	else
			return self.i18nStringsDefaults[key];
};

ControllerMetaradio.prototype.setMetadata = function (url) {
	var self = this;
	self.logger.verbose('CALLED_SET_METADATA');
	return self.scraper.getMetadata(self.context, url)
		.then(function (result) {
			return libQ.resolve(self.pushSongState(result))
				.then(function () {
					self.timer = new Timer(self.setMetadata.bind(self), [url], 20);
				});
		});
}

ControllerMetaradio.prototype.pushSongState = function (metadata) {
	var self = this;
	self.logger.verbose('METADATA_FETCHED '+JSON.stringify(metadata));
	self.state = {
		status: 'play',
		service: self.serviceName,
		type: 'webradio',
		trackType: 'aac',
		radioType: 'fip',
		albumart: metadata.cover,
		uri: 'http://direct.fipradio.fr/live/fip-hifi.aac', // TODO
		name: 'France Inter Paris',
		title: metadata.title,
		artist: metadata.artist,
		album: metadata.album,
		streaming: true,
		disableUiControls: true,
		duration: 20,
		seek: 0,
		//samplerate: '44.1 KHz',
		//bitdepth: '16 bit',
		//channels: 2
	};
	self.logger.verbose('PUSH_SONG '+JSON.stringify(self.state));
	
	//workaround to allow state to be pushed when not in a volatile state
	var vState = self.commandRouter.stateMachine.getState();
	var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];

	queueItem.name =  metadata.title;
	queueItem.artist =  metadata.artist;
	queueItem.album = metadata.album;
	queueItem.albumart = metadata.cover;
	queueItem.trackType = 'FIP';
	queueItem.duration = 20;
	//queueItem.samplerate = '44.1 KHz';
	//queueItem.bitdepth = '16 bit';
	//queueItem.channels = 2;
	
	//reset volumio internal timer
	self.commandRouter.stateMachine.currentSeek = 0;
	self.commandRouter.stateMachine.playbackStart=Date.now();
	self.commandRouter.stateMachine.currentSongDuration=20/*metadata.time*/;
	self.commandRouter.stateMachine.askedForPrefetch=false;
	self.commandRouter.stateMachine.prefetchDone=false;
	self.commandRouter.stateMachine.simulateStopStartDone=false;

	//volumio push state
	self.commandRouter.servicePushState(self.state, self.serviceName);
};

function Timer(callback, args, delay) {
	var self = this;
	var start, remaining = delay;

	var nanoTimer = new NanoTimer();

	Timer.prototype.pause = function () {
		nanoTimer.clearTimeout();
		remaining -= new Date() - start;
	};

	Timer.prototype.resume = function () {
		start = new Date();
		nanoTimer.clearTimeout();
		nanoTimer.setTimeout(callback, args, remaining + 'm');
	};

	Timer.prototype.clear = function () {
		nanoTimer.clearTimeout();
	};

	this.resume();
};