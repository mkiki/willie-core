/**
 * @file Willie 'core' module - Module configuration
 *
 * <p>Database access function for the core module. Typically users and session management
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Database = require('wg-database').Database;
const WebServer = require('./webServer.js');
const moment = require('moment');
const net = require('net');
const extend = require('extend');
const ModuleConfig = require('./config.js');
const fs = require('fs');
var CoreDatabase = require('./database.js');

const log = Log.getLogger('willie-core::module');

// Web server
var server = undefined;

/**
 * @module core/module
 */


/** ================================================================================
  * Module life cycle
  * ================================================================================ */

/**
 * 
 * @class Module
 */
function Module() {
  this.config = undefined;
  this.moduleConfig = ModuleConfig.defaultConfig;
  this.modules = [];
}

/**
 * Start the module.
 * @memberOf Module
 *
 * @param config - Willie application configuration
 * @param modules - Array of willie modules
 */
Module.prototype.start = function(config, moduleConfig, modules, callback) {
  var that = this;
  log.debug("Starting module");
  moduleConfig = extend(true, {}, ModuleConfig.defaultConfig, moduleConfig);
  return ModuleConfig.check(moduleConfig, function(err) {
    if (err) return callback(new Exception(undefined, "Configuration fail checked", err));
    log.debug({err:err, moduleConfig:moduleConfig}, "Configuration loaded.");
    if (err) return callback(err);
    that.config = config;
    that.moduleConfig = moduleConfig;
    that.modules = modules;
    log.debug("Module started");
    return callback();
  });
}

/**
 * Shuts down the module.
 * @memberOf Module
 *
 * @param {Module~shutdown_callback} callback - is the return function
 */
Module.prototype.shutdown = function(callback) {
  log.debug("Shutting down module");
  var that = this;
  if (!server) 
    return callback();
  log.info("Shutting down web server");
  return server.close(function() {
    return callback();
  });
}
/**
 * Callback for the shutdown function.
 * @ignore
 *
 * @callback Module~shutdown_callback
 * @param err - is the error code/message
 *
 * @see shutdown
 */





/** ================================================================================
  * Module command : set user password
  * ================================================================================ */


/**
 * Password command: set user's passwords.
 * @memberOf Module
 * @ignore
 *
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the first command parameter
 * @param {Module~passwordCommand_callback} callback - is the return function
 */
Module.prototype.passwordCommand = function(argv, callback) {
  var that = this;
  var user = argv[0];
  argv.shift();
  var password = argv[0];
  argv.shift();
  log.info("Changing password for user", user);

  if (!password || password.length === 0) {
    log.error("Password cannot be empty");
    return callback();
  }
  else {
    var adminContext = { authenticated:true, isAdmin:true, user:{}, rights:{} };
    var db = new Database(that.config.cnx);
    return that._updatePassword(db, adminContext, user, password, function(err) {
      return Database.shutdown(function() {
        return callback(err);
      });
    });
  }
}
/**
 * Callback for the passwordCommand function.
 * @memberOf Module
 * @ignore
 *
 * @callback Module~passwordCommand_callback
 * @param err - is the error code/message
 *
 * @see passwordCommand
 */


Module.prototype._updatePassword = function(db, userContext, login, password, callback) {
  var that = this;
  var Auth = require('./auth.js');
  return Auth.changePassword(db, userContext, login, password, function(err) {
    if (err) return callback(err);
    log.info("Password changed for " + login);
    return callback();
  });
}



/** ================================================================================
  * Module command : add user
  * ================================================================================ */


/**
 * Add user command
 * @memberOf Module
 * @ignore
 *
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the first command parameter
 * @param {Module~passwordCommand_callback} callback - is the return function
 */
Module.prototype.addUserCommand = function(argv, callback) {
  var that = this;
  var login = argv[0];
  argv.shift();
  var name = argv[0];
  argv.shift();
  var email = argv[0];
  argv.shift();
  log.info({login:login, name:name, email:email}, "Adding user");

  if (!login || login.length === 0) {
    log.error("Login cannot be empty");
    return callback();
  }
  else {
    var adminContext = { authenticated:true, isAdmin:true, user:{}, rights:{} };
    var db = new Database(that.config.cnx);
    return that._addUser(db, adminContext, login, name, email, function(err) {
      return Database.shutdown(function() {
        return callback(err);
      });
    });
  }
}

Module.prototype._addUser = function(db, userContext, login, name, email, callback) {
  var that = this;
  var Auth = require('./auth.js');
  return CoreDatabase.addUser(db, userContext, login, name, email, function(err) {
    if (err) return callback(new Exception({login:login}, "Failed to add user", err));
    log.info({login:login}, "User added.");
    return callback();
  });
}




/** ================================================================================
  * Module command : stop the web server
  * ================================================================================ */

/**
 * stop command: stop running process
 * return code (of the process)
 * <li>0 = ok (server was successfully stopped)
 * <li>1 = ko (server was not running)
 * <li>2 = other error
 * @memberOf Module
 * @ignore
 *
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the first command parameter
 * @param {Module~stopCommand_callback} callback - is the return function
 */
Module.prototype.stopCommand = function(argv, callback) {
  var that = this;
  log.info("Running stop command");

  var client = new net.Socket();
  client.on('error', function(err) {
    switch (err.code) {
      case 'ECONNREFUSED': {
        // Server probably does not run => ok
        log.info("Could not connect to photos server. Server is probably not running");
        process.exit(1);
        break;
      }
      case 'ECONNRESET': {
        // Server closed connection => it ok (we are stopping the server and it stoppped)
        log.info("Photos server stopped");
        process.exit(0);
        break;
      }
      default: {
        log.error({err:err}, "An error occured");
        process.exit(2);
        break;
      }
    }
  });
  return client.connect(that.config.shutdown.port, that.config.shutdown.interface, function() {
    client.write('Please shutdown.');
    client.end();
  });
}
/**
 * Callback for the stopCommand function.
 * @ignore
 *
 * @callback Module~stopCommand_callback
 * @param err - is the error code/message
 *
 * @see stopCommand
 */




/** ================================================================================
  * Module command : start the web server
  * ================================================================================ */


/**
 * web Command: start Web Server
 * @memberOf Module
 * @ignore
 *
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the first command parameter
 * @param {Module~webCommand_callback} callback - is the return function
 */
Module.prototype.webCommand = function(argv, callback) {
  var that = this;
  log.info("Executing web command");
  var webServer = new WebServer(that.config, that.modules);

  // Template parameters
  var options = {
    homeMenu: _computeHomeMenu(that.modules),
    sideMenu: _computeSideMenu(that.modules)
  };

  // Start web server and loop forever
  log.info("Starting web server");
  webServer.start(function(err) {
    if (err) return callback(new Exception(undefined, "Failed to start web server", err));
    var webApps = [];
    var coreWebApp = undefined;

    function _startModule(index, callback) {
      if (index >= that.modules.length) return callback();
      var module = that.modules[index];
      return webServer.startModule(module, function(err, webApp) {
        if (err) log.warn(new Exception({module:module.moduleConfig.name}, "Failed to start module web service", err));
        if (webApp) webApps.push(webApp);
        if (module.moduleConfig.name === 'core') coreWebApp = webApp;
        webServer.setUserTemplateParameters(module, options);
        return _startModule(index+1, callback);
      });
    }

    return _startModule(0, function(err) {
      if (err) return callback(new Exception(undefined, "Failed to start web services", err));

      function getStatsFunction(webApp) {
        if (webApp.getModuleStats) {
          return function() {
            return webApp.getModuleStats.apply(webApp, arguments);
          };
        } 
      }

      // Core module "getStats" function should have access to all modules
      if (coreWebApp) {
        for (var i=0; i<webApps.length; i++) {
          var webApp = webApps[i];
          var fn = getStatsFunction(webApp);
          if (fn) coreWebApp.registerGetStats(fn);
        }
      }


      // Do not return, the web is a server and the process should not stop
    });

  });
}
/**
 * Callback for the webCommand function.
 * @ignore
 *
 * @callback Module~webCommand_callback
 * @param err - is the error code/message
 *
 * @see webCommand
 */


/**
 * Compute the items in the home menu
 * @param {Module[]} modules - list of modules
 * @return the home menu (sorted)
 */
function _computeHomeMenu(modules) {
  var menu = [];
  for( var i=0; i<modules.length; i++) {
    var module = modules[i];
    if (!module.moduleConfig.homeMenu) continue;
    menu = menu.concat(module.moduleConfig.homeMenu);
  }
  menu.sort(function(a, b) {
    return a.index - b.index;
  });
  var homeMenu = [];
  for( var i=0; i<menu.length; i++) {
    homeMenu.push({
      label: menu[i].label,
      href:menu[i].href
    });
  }
  return homeMenu;
}

/**
 * Compute the items in the side menu
 * @param {Module[]} modules - list of modules
 * @return the side menu (sorted)
 */
function _computeSideMenu(modules) {
  var menu = [];
  for( var i=0; i<modules.length; i++) {
    var module = modules[i];
    if (!module.moduleConfig.sideMenu) continue;
    menu = menu.concat(module.moduleConfig.sideMenu);
  }
  menu.sort(function(a, b) {
    return a.index - b.index;
  });
  var sideMenu = [];
  for( var i=0; i<menu.length; i++) {
    sideMenu.push({
      name:   menu[i].name,
      label:  menu[i].label,
      href:   menu[i].href,
      icon:   menu[i].icon,
      index:  menu[i].index
    });
  }
  return sideMenu;
}




/** ================================================================================
  * Module command : cleanup the database (hygiene)
  * ================================================================================ */

/**
 * cleanup Command: run database hygiene
 * @memberOf Module
 * @ignore
 *
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the first command parameter
 */
Module.prototype.cleanupCommand = function(argv, callback) {
  var that = this;
  log.info("Executing database cleanup command");
  var db = new Database(config.cnx);
  return that.cleanup(db, function(err) {
    return Database.shutdown(function(err2) {
      if (err2) log.warn(new Exception(undefined, "Failed to shutdown database after cleanup", err2));
      return callback(err);
    });    
  });
}

/**
 * Cleanup the databaae
 */
Module.prototype.cleanup = function(db, callback) {
  var that = this;
  log.info("Cleaning up database");
  var adminContext = { authenticated:true, isAdmin:true, user:{}, rights:{} };
  log.info("Running database vacuum");
  return db.vacuum(adminContext, function(err) {
    if (err) return callback(err);
    return callback();
  });
}



/** ================================================================================
  * Module commands
  * ================================================================================ */

/**
 * Parse command line arguments and run command.
 * @memberOf Module
 * 
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the command name
 * @param {Module~command_callback} callback - is the return function
 */
Module.prototype.command = function(argv, callback) {
  var that = this;
  var command = argv[0];  // command

  // Decode module options
  while (command && command[0]==='-') {
    log.warn({ arg:command}, "Ignoring parameter");
    command = argv[0];
    argv.shift();
  }
  argv.shift();

  // Execute commands
  if (command === 'password')     return that.passwordCommand(argv, callback);           // set passord
  if (command === 'addUser')      return that.addUserCommand(argv, callback);            // set passord
  if (command === 'stop')         return that.stopCommand(argv, callback);               // stop running command

  if (command === 'web') {    
    // Start socket server. Only listens on a given socket and will shutdown whenever the socket receives anything
    // This is used to implement the 'stop' command
    server = net.createServer();
    log.debug("Connect on [" + that.config.shutdown.port + "] to kill");
    server.listen(that.config.shutdown.port, that.config.shutdown.interface, undefined, function(err) {
      log.debug("Listening for shutdown", err);
    });
    server.on('connection', function(socket) {
      log.warn("Stop signal received; exiting");
      socket.end();
      process.exit(1);
    });

    return that.webCommand(argv, callback);                // start web server
  }

  return callback(new Exception({command:command}, "Invalid command"));
}
/**
 * Callback for the command function.
 *
 * @callback Module~command_callback
 * @param err - is the error code/message
 *
 * @see command
 */



/**
 * help command: display help
 * @memberOf Module
 * @return a multi-line string containing the module help
 */
Module.prototype.getHelpString = function() {
  var that = this;
  var help = "Options:\n"
           + "    No options for this module\n"
           + "Commands:\n"
           + "    stop                            Stop running photos process\n"
           + "    web                             Run the web server\n"
           + "    addUser <login> <name> <email>  Run the web server\n"
           + "    password <user> <password>      Set a user's password\n";
  return help;
}


/**
 * Load a module file
 * @param {string} relativePath - is the file name, relative to the module root
 * @param {function} callback - is the return function, passing the file contents
 */
Module.prototype.loadTextFile = function(relativePath, callback) {
  var filename = __dirname + '/../' + relativePath;
  log.debug({filename:filename}, "Loading text file from module");
  return fs.readFile(filename, 'utf8', function(err, contents) {
    return callback(err, contents);
  });
}


/**
 * Public interface
 */
module.exports = Module;

