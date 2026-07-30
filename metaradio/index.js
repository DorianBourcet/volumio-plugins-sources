'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var Timer = require('./helpers/timer');
var Cache = require('./helpers/cache');
var debug = require('./helpers/debug');
var hash = require('object-hash');

const MIN_DELAY_TO_REFRESH = 20;
const MAX_DELAY_TO_REFRESH = 900;
const DEFAULT_DELAY_TO_REFRESH = 60;

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
  	self.currentStation = {};
	self.cache = new Cache();
	self.scrapingFailureCount = 0;
	// Bumped on every play/stop. A scrape captures it before going out and drops its
	// result if it no longer matches, so an answer that lands after a station change
	// cannot push the previous station's metadata onto the new one.
	self.playGeneration = 0;
	self.latestPushFingerprint = null;
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

    // Without this the polling loop outlives the plugin: it keeps hitting the APIs and
    // mutating Volumio's state machine, and holds the whole controller in memory.
    self.newPlayGeneration();
    self.stopPolling();
    self.cache.clear();
    self.currentStation = {};

    return libQ.resolve();
};

ControllerMetaradio.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

// Invalidates every in-flight scrape and any timer that is still holding a reference to
// the previous play cycle.
ControllerMetaradio.prototype.newPlayGeneration = function() {
	var self = this;
	self.playGeneration++;
	self.latestPushFingerprint = null;
	return self.playGeneration;
};

ControllerMetaradio.prototype.stopPolling = function() {
	var self = this;
	if (self.timer) {
		self.timer.stop();
	}
	self.timer = null;
	self.scraper = null;
};

// Single entry point for (re)arming the metadata loop, so the timer and the scraper are
// always created together and always for the station that is actually playing.
ControllerMetaradio.prototype.startPolling = function() {
	var self = this;

	self.stopPolling();

	if (!self.currentStation.scraper) {
		self.setPlayingTrackInfo(
			self.currentStation.name,
			self.currentStation.albumart,
			null,
			null,
		);
		return;
	}

	self.scraper = new (require(__dirname + '/scrapers/' + self.currentStation.scraper))();
	self.timer = new Timer(self.setMetadata.bind(self), function(result) {return result*1000;}, 0);
	self.timer.start();
};


// Configuration Methods -----------------------------------------------------------------------------

ControllerMetaradio.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

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

		if (!curUri.startsWith(self.serviceName)) {
			return libQ.reject(new Error('metaradio: cannot browse ' + curUri));
		}

    return self.getRadioContent()
			.fail(function (e) {
				self.logger.error('metaradio: handleBrowseUri failed for ' + curUri + ' — ' + (e && e.message));
				return libQ.reject(e);
		});
};



// Define a method to clear, add, and play an array of tracks
ControllerMetaradio.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	debug.debugLog('CLEAR_ADD_PLAYTRACK',JSON.stringify(track))

	// Claimed before the MPD round-trips below, and re-checked once they resolve. Two
	// overlapping calls (fast zapping) used to each install their own Timer, and only the
	// last one stayed reachable — the earlier one polled on forever, unstoppable.
	var generation = self.newPlayGeneration();
	self.stopPolling();
  self.currentStation = {...track};

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::clearAddPlayTrack');

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
				if (queueItem) {
					queueItem.name = track.name;
				}
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
			if (generation !== self.playGeneration) {
				// A newer play took over while MPD was starting: it owns the timer now.
				return;
			}
			self.startPolling();
		})
		.fail(function (e) {
			self.logger.error('metaradio: clearAddPlayTrack failed for ' + track.name + ' — ' + (e && e.message));
			return libQ.reject(e);
		});
};

ControllerMetaradio.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::seek to ' + timepos);

    return libQ.resolve();
};

// Stop
ControllerMetaradio.prototype.stop = function() {
	var self = this;

	self.newPlayGeneration();
	self.stopPolling();
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::stop');

	return self.mpdPlugin.sendMpdCommand('stop', [])
	.then(function () {
		return self.resetPlayingTrack();
	})
	.then(function () {
		return self.mpdPlugin.getState().then(function (state) {
			return self.commandRouter.servicePushState(state, self.serviceName);
		});
	})
	.fail(function (e) {
		self.logger.error('metaradio: stop failed — ' + (e && e.message));
		return libQ.reject(e);
	});
};

// Pause
// Webradio has nothing meaningful to pause, so this is a full stop.
ControllerMetaradio.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::pause');
	return self.stop();
};

// Resume
ControllerMetaradio.prototype.resume = function () {
	var self = this;

	// A fresh cycle: the previous one was torn down by pause()/stop(). startPolling()
	// below rebuilds the timer and the scraper, so restarting a stale timer here (which
	// could belong to a station that is no longer the current one) is not an option.
	var generation = self.newPlayGeneration();
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::resume');
	debug.debugLog('RESUME', JSON.stringify(self.currentStation));

	return self.mpdPlugin.sendMpdCommand('play', [])
		.then(function () {
			return self.mpdPlugin.getState().then(function (state) {
				return self.commandRouter.servicePushState(state, self.serviceName);
			});
		})
		.then(function () {
			if (generation !== self.playGeneration) {
				return;
			}
			self.startPolling();
		})
		.fail(function (e) {
			self.logger.error('metaradio: resume failed — ' + (e && e.message));
			return libQ.reject(e);
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
				debug.debugLog('EXPLODE_URI found station', station.title);
				break;
			}
		}
	} else {
		for (const group in self.radioStations) {
			station = self.radioStations[group].find(item => item.uri === uri);
			if (station) {
				break;
			}
		}
	}

	if (!station) {
		defer.reject(new Error('metaradio: unknown uri ' + uri));
		return defer.promise;
	}

	// No timer teardown here: Volumio also calls explodeUri to merely resolve a URI (queue
	// append, browse), and stopping the timer froze the metadata of the station playing.
	// clearAddPlayTrack owns that transition.
	//let id = self.radioStations[station][channel].uri.replace(/[^a-zA-Z0-9]/g, '');

	response.push({
		service: self.serviceName,
		type: 'track',
		albumart: '/albumart?sourceicon=music_service/'+self.serviceName+'/logos/'+station.logo,
		uri: station.url,
		name: station.title,
		//slogan: 'slogan' in station ? station.slogan : station.title,
		method: station.method,
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

  // Fresh copy per call: returning the shared rootNavigation meant concurrent browses
  // handed out the same mutable object, and it stayed loaded with the full station list.
  var response = JSON.parse(JSON.stringify(self.rootNavigation));
	var items = [];
	for (var station in self.radioStations) {
		for (var channel of self.radioStations[station]) {
				items.push({
					service: self.serviceName,
					type: 'song',
					title: channel.title,
					uri: channel.uri,
					albumart: '/albumart?sourceicon=music_service/'+self.serviceName+'/logos/'+channel.logo
				});
		}
	}
	items.sort(function (a, b) {
		return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
	});
	response.navigation.lists[0].items = items;

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

// `station` is the snapshot the scrape was issued for, not self.currentStation: reading
// the live field here meant a late answer got the *next* station's name and logo as its
// fallbacks, and that pair was then cached under the previous station's key.
ControllerMetaradio.prototype.hydrateMetadata = function (scraped, station) {
	var self = this;

	let now = Math.floor(Date.now() / 1000);
	let metadata = {...scraped};
	let extraDelay = 5;

	if (metadata.title === undefined || metadata.title === null || metadata.title === false) {
		metadata.title = station.name;
		metadata.artist = station.name;
		metadata.album = null;
		metadata.cover = station.albumart;
	}
	else if (metadata.cover === undefined || metadata.cover === null || metadata.cover === false) {
		metadata.cover = station.albumart;
	}
	// Number.isFinite also rejects NaN, which would otherwise reach the cache as a ttl and
	// make the entry immortal.
	if (!Number.isFinite(metadata.delayToRefresh) || metadata.delayToRefresh < MIN_DELAY_TO_REFRESH) {
		if (metadata.endTime > now) {
			metadata.delayToRefresh = Math.max(metadata.endTime - now + extraDelay,MIN_DELAY_TO_REFRESH);
		} else {
			metadata.delayToRefresh = DEFAULT_DELAY_TO_REFRESH;
		}
	}
	metadata.delayToRefresh = Math.min(metadata.delayToRefresh, MAX_DELAY_TO_REFRESH);

	return metadata;
}

// Keyed on the stream URL, which explodeUri maps onto `uri`.
ControllerMetaradio.prototype.cacheKeyFor = function (station) {
	return String(station.uri).replace(/[^a-zA-Z0-9]/g, '');
}

ControllerMetaradio.prototype.getMetadata = function (station) {
	var self = this;
	var defer = libQ.defer();
	let key = self.cacheKeyFor(station);
	let cachedMetadata = self.cache.get(key);
	if (cachedMetadata !== undefined) {
		defer.resolve(cachedMetadata);
		return defer.promise;
	}

	self.scraper.getMetadata(station.api, station.method)
		.then(function (result) {
			self.scrapingFailureCount = 0;
			debug.debugLog('SCRAPED METADATA',result);
			result = self.hydrateMetadata(result, station);
			debug.debugLog('HYDRATED METADATA',result);
			self.cache.set(key, result, result.delayToRefresh);

			defer.resolve(result);
		})
		.fail(function (e) {
			// Resolves rather than rejects: a dead API degrades to the station name instead
			// of breaking playback. The placeholder is cached for the backoff duration so
			// the endpoint stops being hit every minute.
			self.logger.error('metaradio: scraping failed for ' + station.name + ' — ' + (e && e.message ? e.message : e));
			let placeholder = self.getStationMetadata(station);
			self.cache.set(key, placeholder, self.computeScrapingFailureDtr());
			defer.resolve(placeholder);
		});

	return defer.promise;
}

ControllerMetaradio.prototype.getStationMetadata = function (station) {
	return {
		title: station.name,
		artist: station.name,
		album: null,
		cover: station.albumart,
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
		// Volumio seeds playbackStart from Date.now(), i.e. milliseconds.
		self.commandRouter.stateMachine.playbackStart = startTime * 1000;
		if (endTime) {
			var duration = endTime - startTime;
		}
	}

	var vState = self.commandRouter.stateMachine.getState();
	if (!vState) { return; }
	// Only bail when another service demonstrably owns playback, so an unset `service`
	// (which happens early in a transition) still gets its metadata.
	if (vState.service && vState.service !== self.serviceName) {
		debug.debugLog('SKIP_PUSH: active service is', vState.service);
		return;
	}
	var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
	if (!queueItem) { return; }

	// The loop ticks every 5s while the cache holds the same answer for 20s to 900s.
	// Pushing regardless rewrote vState and zeroed currentSeek each time, which both
	// spammed every socket.io client and kept the progress bar from advancing. `seek` is
	// deliberately out of the fingerprint: Volumio moves it on its own between changes.
	var fingerprint = hash({title, cover, artist, album, duration, startTime});
	if (fingerprint === self.latestPushFingerprint) { return; }
	self.latestPushFingerprint = fingerprint;

	if (seek) {
		vState.seek = seek;
		self.commandRouter.stateMachine.currentSeek = seek;  // reset Volumio timer
	} else {
		vState.seek = 0;
		self.commandRouter.stateMachine.currentSeek = 0;  // reset Volumio timer
	}
	vState.disableUiControls = true;

	if (duration) {
		vState.duration = duration;
		queueItem.duration = duration;
		self.commandRouter.stateMachine.currentSongDuration = duration;
	} else {
		vState.duration = 0;
		queueItem.duration = 0;
		self.commandRouter.stateMachine.currentSongDuration = 0;
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
	// Snapshot both, so a scrape that outlives its play cycle neither pushes nor hydrates
	// against whatever station has taken over in the meantime.
	var generation = self.playGeneration;
	var station = self.currentStation;

	return self.getMetadata(station)
		.then(function (result) {
			if (generation !== self.playGeneration) {
				return 5;
			}
			var now = Math.floor(Date.now() / 1000);
			if (result.endTime && now >= result.endTime) {
				result = self.getStationMetadata(station);
			}
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
	if (!vState) { return; }
	if (vState.service && vState.service !== self.serviceName) { return; }
	let queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];
	if (!queueItem) { return; }
	self.latestPushFingerprint = null;
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