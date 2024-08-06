'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
const NanoTimer = require('nanotimer');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var test = require('./helpers/foo');
var Timer = require('./helpers/timer');
var Cache = require('./helpers/cache');
var hash = require('object-hash');

module.exports = ControllerMetaradio;

function ControllerMetaradio(context) {
	var self = this;

	self.context = context;
	self.commandRouter = this.context.coreCommand;
	self.logger = this.context.logger;
	self.configManager = this.context.configManager;
	self.name = 'Metaradio';
	self.serviceName = 'metaradio';
	self.timer = null;
	self.scraper = null;
	self.latestTitleInfo = null;
	self.titleInfoAttempt = 0;
  	self.currentStation = {};
	self.cache = new Cache();
	self.computedStartTimes = {};
	self.scrapingFailureCount = 0;
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
  var data = {
		name: self.name,
		uri: self.serviceName,
		plugin_type: 'music_service',
		plugin_name: self.serviceName,
		albumart: '/albumart?sourceicon=music_service/metaradio/metaradio.svg'
	};

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
	console.log('CLEAR_ADD_PLAYTRACK',JSON.stringify(track))
	/*if (Object.entries(self.currentStation).length > 0) {
		self.resetPlayingTrack();
	}*/
  self.currentStation = {...track};

	if (self.timer) {
		self.timer.stop();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::clearAddPlayTrack');
	self.commandRouter.logger.info(JSON.stringify(track));

	return self.mpdPlugin.sendMpdCommand('stop', [])
		.then(function () {
			return self.mpdPlugin.sendMpdCommand('clear', []);
		})
		.then(function () {
			return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
		})
		.then(function () {
			//self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

			return self.mpdPlugin.sendMpdCommand('play', []);
		})
		.then(function () {
			return self.mpdPlugin.getState().then(function (state) {
				var vState = self.commandRouter.stateMachine.getState();
				var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
				queueItem.name = track.name;
				//queueItem.trackType = track.name;
				//vState.trackType = track.name;
				/*queueItem.bitrate = state.bitrate;
				queueItem.samplerate = state.samplerate+' kHz';
    		queueItem.bitdepth = state.bitdepth;*/
				//self.commandRouter.servicePushState(vState, self.serviceName);
				return self.commandRouter.stateMachine.syncState(state, self.serviceName);
			});
		})
		.then(function () {
			if (track.scraper) {
				self.scraper = new (require(__dirname + '/scrapers/' + track.scraper))();
				self.timer = new Timer(self.setMetadata.bind(self), function(result) {return result*1000;}, 0);
				self.timer.start();
				//return self.setMetadata(track.api);
			} else {
				self.setPlayingTrackInfo(
					self.currentStation.name,
					self.currentStation.albumart,
					null,
					null,
				);
			}
	
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
		self.timer.stop();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::stop');

	return self.mpdPlugin.sendMpdCommand('stop', [])
	.then(self.resetPlayingTrack())
	.then(function () {
		return self.mpdPlugin.getState().then(function (state) {
			return self.commandRouter.servicePushState(state, self.serviceName);
		});
	})
	/*return self.mpdPlugin.stop().then(function () {
		return self.mpdPlugin.getState().then(function (state) {
				return self.commandRouter.stateMachine.syncState(state, self.serviceName);
		});
  });*/
};

// Pause
ControllerMetaradio.prototype.pause = function() {
	var self = this;
	self.stop();
	return;

	if (self.timer) {
		self.timer.stop();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::pause');
	return self.mpdPlugin.sendMpdCommand('pause', [1])
    .then(self.resetPlayingTrack());
};

// Resume
ControllerMetaradio.prototype.resume = function () {
	var self = this;

	if (self.timer) {
		self.timer.start();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::resume');
	self.commandRouter.logger.info(JSON.stringify(self.currentStation));

	return self.mpdPlugin.sendMpdCommand('play', [])
		.then(function () {
			return self.mpdPlugin.getState().then(function (state) {
				return self.commandRouter.servicePushState(state, self.serviceName);
			});
		})
		.then(function () {
			if (self.currentStation.scraper) {
				self.scraper = new (require(__dirname + '/scrapers/' + self.currentStation.scraper))();
				self.setMetadata();
			} else {
				self.setPlayingTrackInfo(
					self.currentStation.name,
					self.currentStation.albumart,
					null,
					null,
				);
			}
	
		})
		.fail(function (e) {
			return libQ.reject(new Error());
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
	var station;
	if (uri.includes('://')) {
		// a url was given
		for (const group in self.radioStations) {
			station = self.radioStations[group].find(item => item.url === uri);
			if (station) {
				console.debug('found station');
				console.debug(station);
				break;
			}
		}
	} else {
		var parts = uri.split('/');
		var channel = parseInt(parts[1]);
		var group = parts[0].substring(3);
		station = self.radioStations[group][channel];
	}

	if (self.timer) {
		self.timer.stop();
	}
	//let id = self.radioStations[station][channel].uri.replace(/[^a-zA-Z0-9]/g, '');
	
	response.push({
		service: self.serviceName,
		type: 'track',
		albumart: '/albumart?sourceicon=music_service/'+self.serviceName+'/logos/'+station.logo,
		uri: station.url,
		name: station.title,
		//slogan: 'slogan' in station ? station.slogan : station.title,
		api: station.api,
		scraper: station.scraper
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

ControllerMetaradio.prototype.hydrateMetadata = function (scraped) {
	var self = this;

	let now = Math.floor(Date.now() / 1000);
	let metadata = {...scraped};
	let extraDelay = 5;

	// if (metadata.startTime === undefined || metadata.startTime === null || metadata.startTime > now) {
	// 	metadata.startTime = self.computeStartTime(metadata);
	// }
	// if (JSON.stringify(scraped) === '{}') {
	// 	metadata.endTime = now + 300;
	// }
	// if (metadata.endTime === undefined || metadata.endTime === null || metadata.endTime < now) {
	// 	metadata.endTime = self.computeEndTime(metadata);
	// 	extraDelay = 0;
	// }
	if (metadata.title === undefined || metadata.title === null || metadata.title === false) {
		metadata.title = self.currentStation.name;
		metadata.artist = self.currentStation.name;
		metadata.album = null;
		metaradio.cover = self.currentStation.albumart;
	}
	else if (metadata.cover === undefined || metadata.cover === null || metadata.cover === false) {
		metadata.cover = self.currentStation.albumart;
	}
	if (metadata.delayToRefresh === undefined || metadata.delayToRefresh === null || metadata.delayToRefresh < 20) {
		if (metadata.endTime > now) {
			metadata.delayToRefresh = Math.max(metadata.endTime - now + extraDelay,20);
		} else {
			metadata.delayToRefresh = 60;
		}
	}

	return metadata;
}

ControllerMetaradio.prototype.computeStartTime = function (metadata) {
	var self = this;

	let key = hash(metadata);
  if (self.computedStartTimes[self.currentStation.name] === undefined
	|| self.computedStartTimes[self.currentStation.name][key] === undefined) {
		let now = Math.floor(Date.now() / 1000);
		self.computedStartTimes = {...self.computedStartTimes, ...{[self.currentStation.name]: {[key]: now}}};
	}
	return self.computedStartTimes[self.currentStation.name][key];
}

ControllerMetaradio.prototype.computeEndTime = function (metadata) {
	var self = this;

	var titleInfo = [metadata.title, metadata.artist].join('-');
	var now = Math.floor(Date.now() / 1000);
	if (titleInfo !== self.latestTitleInfo) {
		self.latestTitleInfo = titleInfo;
		self.titleInfoAttempt = 0;
	}
	self.titleInfoAttempt++;
	if (self.titleInfoAttempt >= 20) {
		return now + 85;
	}
	if (self.titleInfoAttempt >= 10) {
		return now + 55;
	}
	if (self.titleInfoAttempt >= 5) {
		return now + 40;
	}
	if (self.titleInfoAttempt == 2) {
		return now + 60;
	}
	if (self.titleInfoAttempt == 1) {
		return now + 30;
	}
	var seek = now - metadata.startTime;
	if (seek < 90) {return now + 90 - seek;}
	return now + 25;
}

ControllerMetaradio.prototype.getMetadata = function () {
	var self = this;
	var defer = libQ.defer();
	let key = self.currentStation.uri.replace(/[^a-zA-Z0-9]/g, '');
	let cachedMetadata = self.cache.get(key);
	if (cachedMetadata === undefined) {
		self.scraper.getMetadata(self.currentStation.api)
			.then(function (result) {
				self.scrapingFailureCount = 0;
				console.log('SCRAPED METADATA',result);
				result = self.hydrateMetadata(result);
				console.log('HYDRATED METADATA',result);
				self.cache.set(key, result, result.delayToRefresh);

				defer.resolve(result);
			})
			.fail(function (e) {
				console.log('FAILED SCRAPING METADATA',e);
				self.cache.set(key, self.getCurrentStationMetadata(), self.computeScrapingFailureDtr());
				defer.resolve(result);
			});
	} else {
		// var now = Math.floor(Date.now() / 1000);
		// if (cachedMetadata.endTime && cachedMetadata.endTime < now) {
		// 	console.log('EXPIRED, GETTING CURRENT STATION INFO', cachedMetadata.endTime);
		// 	defer.resolve(self.getCurrentStationMetadata());
		// }
		defer.resolve(cachedMetadata);
	}

	return defer.promise;
}

ControllerMetaradio.prototype.getCurrentStationMetadata = function () {
	var self = this;
	return {
		title: self.currentStation.name,
		artist: self.currentStation.name,
		album: null,
		cover: self.currentStation.albumart,
	};
}

ControllerMetaradio.prototype.computeScrapingFailureDtr = function () {
	var self = this;
	self.scrapingFailureCount++;
	if (self.scrapingFailureCount == 1) {
		return 15;
	}
	if (self.scrapingFailureCount == 2) {
		return 60;
	}
	if (self.scrapingFailureCount == 3) {
		return 120;
	}
	if (self.scrapingFailureCount == 4) {
		return 300;
	}
	if (self.scrapingFailureCount == 5) {
		return 600;
	}
	return 900;
}

ControllerMetaradio.prototype.setPlayingTrackInfo = function (title, cover, artist = null, album = null, startTime=null, endTime=null) {
	var self = this;
	if (startTime) {
		var seek = Date.now() - startTime * 1000;
		self.commandRouter.stateMachine.playbackStart = startTime;
		if (endTime) {
			var duration = endTime - startTime;
		}
	}
	
	var vState = self.commandRouter.stateMachine.getState();
	var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
	if (seek) {
		vState.seek = seek;
		self.commandRouter.stateMachine.currentSeek = seek;  // reset Volumio timer
	}
	vState.disableUiControls = true;

	if (duration) {
		vState.duration = duration;
		queueItem.duration = duration;
		self.commandRouter.stateMachine.currentSongDuration = duration;
	}

	vState.albumart = cover;
	queueItem.albumart = cover;

	vState.name = title;
	queueItem.name = title;
	vState.artist = artist;
	queueItem.artist = artist;
	vState.album = album;
	queueItem.album = album;

	queueItem.trackType = self.currentStation.name;
	//vState.trackType = self.currentStation.name;

	self.commandRouter.stateMachine.askedForPrefetch=false;
	self.commandRouter.stateMachine.prefetchDone=false;
	self.commandRouter.stateMachine.simulateStopStartDone=false;

	self.commandRouter.servicePushState(vState, self.serviceName);
}

ControllerMetaradio.prototype.setMetadata = function () {
	var self = this;
	return self.getMetadata()
		.then(function (result) {
			self.setPlayingTrackInfo(
				result.title,
				result.cover,
				result.artist,
				result.album,
				result.startTime,
				result.endTime
			);
			return 5;
		});
}

ControllerMetaradio.prototype.resetPlayingTrack = function () {
	let self = this;
	let vState = self.commandRouter.stateMachine.getState();
	let queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
	vState.seek = 0;
	vState.disableUiControls = true;

	vState.duration = 0;
	queueItem.duration = 0;

	vState.albumart = self.currentStation.albumart;
	queueItem.albumart = self.currentStation.albumart;

	vState.name =  self.currentStation.name;
	queueItem.name =  self.currentStation.name;
	vState.artist =  null;
	queueItem.artist =  null;
	vState.album = null;
	queueItem.album = null;
	queueItem.samplerate = null;
	vState.samplerate = null;
  	queueItem.bitdepth = null;
	vState.bitdepth = null;
}