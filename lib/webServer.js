/**
 * @file willie-core - Web server
 *
 * Creates, start and stop a web server, and provides a framework to start each module web application
 * within this framework.
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */
const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Database = require('wg-database').Database;
const DatabaseFactory = require('wg-database').DatabaseFactory;

const database = require('./database.js');
const WebHelper = require('./webHelper.js');

const log = Log.getLogger('willie-core::webServer');


/** ================================================================================
  * Web Server
  * ================================================================================ */

/**
 * 
 * @class Web
 */
WebServer = function(config) {
  this._config = config;              // General configuration
  this._server = undefined;           // HTTP server
  this._app;                          // express app
  this._webDefaultContextData = {     // Data that will be passed to all views (default)
    userContext: {
      showUser:       true,
      databaseId:     undefined       // database identifier (set by the _getDatabaseId call)
    },
    env:              config.env,
    version:          config.version,
    copyright:        "Willie " + config.version + " · © Alexandre Morin 2015 - 2016",
    mapsAPIKey:       config.mapsAPIKey
  };
  this._helpers = {};                 // module helpers (key = module name)
  this._webApps = {};                 // web apps (key = module name)
}

/**
 * Read database identifier
 * @ignore
 */
WebServer.prototype._getDatabaseId = function(callback) {
  var that = this;
  var userContext = { authenticated:true, isAdmin:true, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:true, auth:true} };
  var dbFactory = new DatabaseFactory(that._config.cnx);
  return dbFactory.createDatabase(function(err, db) {
    if (err) return callback(new Exception(undefined, "Failed to create the database", err));
    return database.getDatabaseId(db, userContext, function(err, databaseId) {
      if (err) return callback(new Exception(undefined, "Failed to read the database identifier", err));
      log.info({ databaseId:databaseId }, "Reading database identifier");
      that._webDefaultContextData.userContext.databaseId = databaseId;
      return callback();
    });
  });
};

/**
 * Set user attributes that will be passed to the JADE templates
 *
 * @param {Module} module - the module for which the option(s) will be set
 * @param options - is a litteral object which will be set in the user template parameters
 */
WebServer.prototype.setUserTemplateParameters = function(module, options) {
  var that = this; 
  var name = module.moduleConfig.name;
  var helper = that._helpers[name];
  if (helper) {
    helper.setUserTemplateParameters(options);
  }
}

/**
 * Start the web service for a module
 * 
 * @param {Module} module - the module to start
 * @param {WebApp} - the WebApp object for the module
 */
WebServer.prototype.startModule = function(module, callback) {
  var that = this;
  var config = module.moduleConfig;
  var name = config.name;
  if (that._helpers[name]) log.warn(new Exception({module:name}, "Attempting to start same module twice"));
  log.debug({module:name}, "Starting web service for module");
  var dbFactory = new DatabaseFactory(that._config.cnx);

  var webHelper = new WebHelper(config.path, that._webDefaultContextData, dbFactory);
  that._helpers[name] = webHelper;

  const WebApp = require(config.path + '/lib/web.js');
  var webApp = new WebApp(webHelper, module);
  that._webApps[name] = webApp;
  return webApp.start(express, that._app, function(err) {
    if (err) return callback(new Exception({module:name}, "Failed to start the web service of the module", err));
      return callback(undefined, webApp);
  });
}


/**
 * Start the web server
 * 
 * @param callback - return function
 * @param {Web~start_callback} callback - is the return function
 */ 
WebServer.prototype.start = function(callback) {
  var that = this;

  log.debug("Starting web server");

  that._app = express();  
  that._app.use(bodyParser.json());                           // support json encoded bodies
  that._app.use(bodyParser.urlencoded({ extended: true }));   // support encoded bodies
  that._app.use(cookieParser());                              // support for reading cookies

  // Setup template engine
  that._app.set('views', './views');
  that._app.set('view engine', 'jade');
  that._app.engine('jade', require('jade').__express);

  // Setup static access to file system
  //that._app.use('/fs',                    express.static("/"));
  that._app.set('json spaces', 2);

  return that._getDatabaseId(function (err) {
    if (err) return callback(new Exception(undefined, "Failed to read database identifier", err));
    that._server = that._app.listen(that._config.web.port, function () {
      var host = that._server.address().address;
      var port = that._server.address().port;
      log.info({ host:host, port:port, endPoint:"http://"+host+":"+port }, 'App listening');
      return callback();
    });

  });
};
/**
 * Callback for the start function.
 *
 * @callback Web~start_callback
 * @param err - is the error code/message
 *
 * @see start
 */



/**
 * Shutdown server
 */
WebServer.prototype.shutdown = function(callback) {
  var that = this;
  log.info("Shutting down web server");
  if (!that._server) return callback();
  return that._server.close(function() {
    return callback();
  });
}



/**
 * Public interface
 */
module.exports = WebServer;
