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
  self.currentTrack = {};
	self.cache = new Cache();
	self.stationTitleList = [];
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
	if (!self.stationTitleList.includes(track.name)) {
		self.currentTrack = {...track};
	}

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
				self.pushState(self.fallbackState());
				/*var vState = self.commandRouter.stateMachine.getState();
				var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
				queueItem.name = track.name;*/
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
			self.scraper = new (require(__dirname + '/scrapers/' + track.scraper))();
			self.timer = new Timer(self.pushProperState.bind(self), function(result) {return result*1000;}, 1000);
			self.timer.start();
			//return self.pushProperState(track.api);
	
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

	if (self.timer) {
		self.timer.stop();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::pause');
	return self.mpdPlugin.sendMpdCommand('pause', [1])
    .then(function () {
			self.pushState(self.fallbackState());
    });
};

// Resume
ControllerMetaradio.prototype.resume = function () {
	var self = this;

	if (self.timer) {
		self.timer.start();
	}
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::resume');
	self.commandRouter.logger.info(JSON.stringify(self.currentTrack));

	return self.mpdPlugin.sendMpdCommand('play', [])
		.then(function () {
			return self.mpdPlugin.getState().then(function (state) {
				return self.commandRouter.servicePushState(state, self.serviceName);
			});
		})
		.then(function () {
			self.scraper = new (require(__dirname + '/scrapers/' + self.currentTrack.scraper))();
			self.pushProperState();
	
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
	var uris = uri.split('/');
	var channel = parseInt(uris[1]);
	var station = uris[0].substring(3);

	if (self.timer) {
		self.timer.stop();
	}
	//let id = self.radioStations[station][channel].uri.replace(/[^a-zA-Z0-9]/g, '');
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
				let radio = {
					service: self.serviceName,
					type: 'song',
					title: channel.title,
					uri: channel.uri,
					albumart: '/albumart?sourceicon=music_service/'+self.serviceName+'/logos/'+channel.logo
				};
				response.navigation.lists[0].items.push(radio);
				self.stationTitleList.push(channel.title);
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

ControllerMetaradio.prototype.hydrateMetadata = function (metadata) {
	var self = this;

	let scraped = {...metadata};
	let now = Math.floor(Date.now() / 1000);
	let extraDelay = 5;

	if (!scraped.startTime || scraped.startTime > now) {
		scraped.startTime = now;
	}
	if (!scraped.endTime || scraped.endTime < now) {
		scraped.endTime = self.computeEndTime(scraped);
		extraDelay = 0;
	}
	if (!scraped.cover || !self.isValidUrl(scraped.cover)) {
		scraped.cover = self.currentTrack.albumart;
	}
	/*if (!scraped.delayToRefresh || scraped.delayToRefresh < 20) {
		scraped.delayToRefresh = Math.max(scraped.endTime - now + extraDelay,20);
	}*/

	return scraped;
}

ControllerMetaradio.prototype.isValidUrl = function (urlString) {
	try { 
		return Boolean(new URL(urlString)); 
	}
	catch(e){ 
		return false; 
	}
}

ControllerMetaradio.prototype.computeEndTime = function (metadata) {
	var self = this;

	var titleInfo = [metadata.title, metadata.artist].join('-');
	var now = Math.floor(Date.now() / 1000);
	if (titleInfo !== self.latestTitleInfo) {
		self.latestTitleInfo = titleInfo;
		self.titleInfoAttempt = 0;

		var seek = now - metadata.startTime;

		if (seek < 150) {return now + 150 - seek;}
	}
	else {
		self.titleInfoAttempt++;
	}

	return now + 20;
}

ControllerMetaradio.prototype.getMetadata = function () {
	let self = this;
	let defer = libQ.defer();
	let key = self.currentTrack.uri.replace(/[^a-zA-Z0-9]/g, '');
	let cachedMetadata = self.cache.get(key);
	console.log(cachedMetadata === undefined);
	console.log(self.cache.canRefresh(key));
	if (cachedMetadata === undefined && self.cache.canRefresh(key)) {
		console.log('IN THE IF');
		self.scraper.getMetadata(self.currentTrack.api)
			.then(function (result) {
				console.log('API_RESULT '+JSON.stringify(result));
				result = self.hydrateMetadata(result);
				let ttl = Math.floor(result.endTime - Date.now() / 1000);
				let ttr = result.delayToRefresh || null;
				self.cache.set(key, result, ttl, ttr);

				defer.resolve(result);
			});
	} else {
		console.log('IN THE ELSE');
		defer.resolve(cachedMetadata);
	}

	return defer.promise;
}

ControllerMetaradio.prototype.setMetadata = function () {
	var self = this;
	return self.getMetadata()
		.then(function (result) {
			var duration = result.endTime - result.startTime;
			var seek = Date.now() - result.startTime * 1000;
			var vState = self.commandRouter.stateMachine.getState();
			var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
			vState.seek = seek;
			console.log('COMPUTED_SEEK '+seek);
			console.log('COMPUTED_REMAINING '+(result.endTime * 1000 - Date.now()));
			vState.disableUiControls = true;

			vState.duration = duration;
			queueItem.duration = duration;

			vState.albumart = result.cover;
			queueItem.albumart = result.cover;

			vState.name =  result.title;
			queueItem.name =  result.title;
			vState.artist =  result.artist;
			queueItem.artist =  result.artist;
			vState.album = result.album;
			queueItem.album = result.album;

			//queueItem.trackType = self.currentTrack.name;
			//vState.trackType = self.currentTrack.name;

			self.commandRouter.stateMachine.currentSeek = seek;  // reset Volumio timer
			self.commandRouter.stateMachine.playbackStart=result.startTime;
			self.commandRouter.stateMachine.currentSongDuration=duration;
			self.commandRouter.stateMachine.askedForPrefetch=false;
			self.commandRouter.stateMachine.prefetchDone=false;
			self.commandRouter.stateMachine.simulateStopStartDone=false;

			self.commandRouter.servicePushState(vState, self.serviceName);

			/*self.mpdPlugin.getState().then(function (state) {
				var vState = self.commandRouter.stateMachine.getState();
				var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
				queueItem.name = track.name;
				//queueItem.trackType = track.name;
				//vState.trackType = track.name;
				//queueItem.bitrate = state.bitrate;
				queueItem.samplerate = state.samplerate+' kHz';
    		queueItem.bitdepth = state.bitdepth;
				//self.commandRouter.servicePushState(vState, self.serviceName);
				self.commandRouter.stateMachine.syncState(state, self.serviceName);
			});*/

			//return result.delayToRefresh;
			return 5;
		});
}

// The fallback state contains static radio metadata
ControllerMetaradio.prototype.fallbackState = function () {
	let self = this;
	console.log('FALLBACK_NAME '+self.currentTrack.name);

	return {
		seek: 0,
		disableUiControls: true,
		duration: 0,
		albumart: self.currentTrack.albumart,
		name: self.currentTrack.name,
		artist: null,
		album: null,
		askedForPrefetch: false,
		prefetchDone: false,
		simulateStopStartDone: false,
	};
}

// The metadata state contains dynamically fetched radio metadata
ControllerMetaradio.prototype.metadataState = function () {
	let self = this;
	return self.getMetadata()
		.then(function (result) {
			if (result === undefined) { return undefined; }
			return {
				seek: Date.now() - result.startTime * 1000,
				startTime: result.startTime,
				disableUiControls: true,
				duration: result.endTime - result.startTime,
				albumart: result.cover,
				name: result.title,
				artist: result.artist,
				album: result.album,
				askedForPrefetch: false,
				prefetchDone: false,
				simulateStopStartDone: false,
			};
		});
}

ControllerMetaradio.prototype.pushProperState = function () {
	let self = this;
	let defer = libQ.defer();
	return self.metadataState().then(function (state) {
		if (state === undefined) {
			self.pushState(self.fallbackState());
			return 1;
		}
		self.pushState(state);
		return 5;
	})
}

ControllerMetaradio.prototype.pushState = function (state) {
	let self = this;
	let vState = self.commandRouter.stateMachine.getState();
	let queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
	vState.seek = state.seek;
	vState.disableUiControls = state.disableUiControls;
	vState.duration = state.duration;
	queueItem.duration = state.duration;
	vState.albumart = state.albumart;
	queueItem.albumart = state.albumart;
	vState.name =  state.name;
	queueItem.name =  state.name;
	vState.artist =  state.artist;
	queueItem.artist =  state.artist;
	vState.album = state.album;
	queueItem.album = state.album;
	self.commandRouter.stateMachine.currentSeek = state.seek;
	if (state.startTime) {
		self.commandRouter.stateMachine.playbackStart = state.startTime;
	}
	self.commandRouter.stateMachine.currentSongDuration = state.duration;
	self.commandRouter.stateMachine.askedForPrefetch = state.askedForPrefetch;
	self.commandRouter.stateMachine.prefetchDone = state.prefetchDone;
	self.commandRouter.stateMachine.simulateStopStartDone = state.simulateStopStartDone;
	self.commandRouter.servicePushState(vState, self.serviceName);
}

ControllerMetaradio.prototype.now = function () {
	return Math.floor(Date.now() / 1000);
}