/**
 * @file Willie 'core' module - Web server
 *
 * <p>Database access function for the core module. Typically users and session management
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */
const extend = require('extend');
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Database = require('wg-database').Database;
const Auth = require('./auth.js');
const CronJob = require('cron').CronJob;

const log = Log.getLogger('core:web');

const coredb = require('./database.js');

/**
 * @module core/web
 */

/** ================================================================================
  * Web App Lifecycle
  * ================================================================================ */

/**
 */
function WebApp(helper, module) {
  this.helper = helper;
  this.module = module;
  this._scheduledCleanupJob = undefined;
  this._cleanupLock = false;
}

/**
 * Start the web application
 * 
 * @param helper -
 * @param callback - 
 */
WebApp.prototype.start = function(express, app, callback) {
  var that = this;
  that.getModuleStatsFunctions = [];

  app.use('/core/css',              express.static(__dirname + "/../css"));
  app.use('/core/js/shared',        express.static(__dirname + "/../shared"));
  app.use('/core/js',               express.static(__dirname + "/../js"));
  app.use('/core/images',           express.static(__dirname + "/../images"));

  // Login
  app.post('/login',                function(req, res) { return that.postLogin(req, res); });
  app.post('/logout',               function(req, res) { return that.postLogout(req, res); });
  // Web pages
  app.get('/',                      function(req, res) { return that.home(req, res); });
  app.get('/help.html',             function(req, res) { return that.help(req, res); });
  app.get('/jobs.html',             function(req, res) { return that.jobs(req, res); });
  // AJax calls
  app.get('/stats',                 function(req, res) { return that.getStats(req, res); });
  app.get('/jobs',                  function(req, res) { return that.getRecentlyModifiedJobs(req, res); });

  return that.startBackgroundJobs(function(err) {
    if (err) return callback(new Exception({module:that.module.moduleConfig.name}, "Failed to start background jobs", err));
    return callback();
  });
}

/**
 * Register functions for each module that will be called by the getStats function
 */
WebApp.prototype.registerGetStats = function(fn) {
  var that = this;
  that.getModuleStatsFunctions.push(fn);
}

/**
 * Get statistics (for the help page) for this module
 */
WebApp.prototype.getModuleStats = function(db, userContext, callback) {
  var that = this;
  var stats = {
    databaseId: undefined
  };
  return coredb.getDatabaseId(db, userContext, function(err, databaseId) {
    if (err) return callback(err);
    stats.databaseId = databaseId;
    var statsWithModuleName = {};
    statsWithModuleName[that.module.moduleConfig.name] = stats;
    return callback(undefined, statsWithModuleName);
  });
}

/** ================================================================================
  * Background jobs
  * ================================================================================ */

/**
 * Start background jobs
 */
WebApp.prototype.startBackgroundJobs = function(callback) {
  var that = this;
  log.info("Running Database Hygiene, five minutes after midnight, every day");
  that._scheduledCleanupJob = new CronJob({
    cronTime: '5 0 * * *',
    onTick: function() { return that._scheduledCleanup(); },
    start: true,
    timeZone: 'UTC'
  });
  return callback();
}

WebApp.prototype._scheduledCleanup = function() {
  var that = this;
  log.info("Running scheduled database hygiene");
  if (that._cleanupLock) {
    log.info("Skipping because database hygiene is currently running");
    return;
  }

  function done(err) {
    that._cleanupLock = false;
    if (err) log.error(undefined, "Failed to run scheduled cleanup", err);
  }

  that._cleanupLock = true;
  try {
    return that.helper.dbFactory.createDatabase(function(err, db) {
      if (err) return done(err);
      return that.module.cleanup(db, function(err) {
        return done(err);
      });
    });
  } catch(ex) {
    return done(ex);
  }
}

/** ================================================================================
  * Views
  * ================================================================================ */

/**
 * Serves the home page (/)
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.home = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Displaying the 'home' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = {
      userContext: {
        showUser: false
      }
    };
    return helper.render(res, userContext, 'home', options);
  });
}


/**
 * Serves the help page (/help.html)
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.help = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Displaying the 'help' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = {};
    return helper.render(res, userContext, 'help', options);
  });
}

/**
 * Serves the jobs page (/jobs.html)
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.jobs = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Displaying the 'jobs' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = {};
    return helper.render(res, userContext, 'jobs', options);
  });
}


/** ================================================================================
  * APIs
  * ================================================================================ */


/**
 * Compile statistics on the database (/stats)
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getStats = function(req, res) {
  var that = this;
  var helper = that.helper;
  var result = {};
  log.debug("Retreiving stats (getStats)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);

    return helper.getParameters([], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);

userContext.isAdmin = true;

      function getNextModuleStats(index, callback) {
        if (index >= that.getModuleStatsFunctions.length) return callback();
        var fn = that.getModuleStatsFunctions[index];
        return fn.call(that, db, userContext, function(err, stats) {
          if (err) log.warn({index:index}, "Failed to get module stats", err);
          if (stats) {
            result = extend(true, result, stats);
          }
          return getNextModuleStats(index+1, callback);
        });
      }

      return getNextModuleStats(0, function(err) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(result, req, res);
      });
    
    });
  });
}


/**
 * ?
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.postLogout = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Logging out");
  return helper.getParameters([], req, function(err, params) {
    if (err) return helper.handleAPIError(err, req, res, undefined);
    var body = req.body;
    log.info({ body:body });
    req.headers[helper.getTokenCookieName()] = undefined;
    req.cookies[helper.getTokenCookieName()] = undefined;
    res.cookie(helper.getTokenCookieName(), undefined);
    return helper.withUserContext(req, res, function(err, db, userContext) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      return helper.sendJSON(userContext, req, res);
    });
  });
};

/**
 * ?
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.postLogin = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Logging in");
  return helper.getParameters([], req, function(err, params) {
    if (err) return helper.handleAPIError(err, req, res, undefined);
    var body = req.body;
    log.info({ body:body });

    var login = body.login;
    var password = body.password;
    if (!login || login.length===0) {
      return helper.withUserContext(req, res, function(err, db, userContext) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(userContext, req, res);
      });
    }

    var credentials = { login:login, password:password };
    var authUserContext = { authenticated:true, isAdmin:false, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:false, auth:true} };

    return that.helper.dbFactory.createDatabase(function(err, db) {
      if (err) return done(err);
      return Auth.authenticate(db, authUserContext, credentials, function(err, session) {
        if (err) return helper.handleAPIError(err, req, res, undefined);
        req.headers[helper.getTokenCookieName()] = session.accessToken;
        req.cookies[helper.getTokenCookieName()] = session.accessToken;
        res.cookie(helper.getTokenCookieName(), session.accessToken, { maxAge: 900000, httpOnly: true })
        return helper.withUserContext(req, res, function(err, db, userContext) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          return helper.sendJSON(userContext, req, res);
        });
      });
    });    
  });
}



/**
 * Get recent jobs
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getRecentlyModifiedJobs = function(req, res) {
  var that = this;
  var helper = that.helper;
  var result = {};
  log.debug("Retreiving jobs (getRecentlyModifiedJobs)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
/*
    if (!userContext.isAdmin) {
      // Only admin can view database stats
      log.debug("Skipping stats computation for non-admin user context");
      return helper.sendJSON({}, req, res);
    }
*/
    return helper.getParameters([], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      return coredb.getRecentlyModifiedJobs(db, userContext, function(err, jobs) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(jobs, req, res);
      });
    });
  });
}



/**
 * Public interface
 * @ignore
 */
module.exports = WebApp;
