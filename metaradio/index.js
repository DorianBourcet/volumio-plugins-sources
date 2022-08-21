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

}



ControllerMetaradio.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);

    return libQ.resolve();
}

ControllerMetaradio.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	self.addToBrowseSources();
	self.addRadioResource();
	self.serviceName = "metaradio";

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
    var data = {name: 'Metaradio', uri: 'metaradio',plugin_type:'music_service',plugin_name:'metaradio'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerMetaradio.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;
		if (curUri.startsWith('metaradio')) {
			response = self.getRadioContent();
			self.logger.info('IN METADATA');
		}
		self.logger.error(response);

    return response;
};



// Define a method to clear, add, and play an array of tracks
ControllerMetaradio.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

ControllerMetaradio.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
ControllerMetaradio.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::stop');


};

// Spop pause
ControllerMetaradio.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'metaradio::pause');


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

	return self.commandRouter.servicePushState(state, self.servicename);
};


ControllerMetaradio.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

ControllerMetaradio.prototype.getAlbumArt = function (data, path) {

	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
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
}

ControllerMetaradio.prototype.getRadioContent = function() {
  var self=this;
  var response;

  response = self.rootNavigation;
  response.navigation.lists[0].items = [];
  for (var key in self.radioStations) {
      var radio = {
        service: self.serviceName,
        type: 'song',
        title: self.radioStations[key].title,
        uri: self.radioStations[key].uri,
        albumart: '/albumart?sourceicon=music_service/personal_radio/logos/'+key+'.png'
      };
      response.navigation.lists[0].items.push(radio);
  }

  return libQ.resolve(response);
};