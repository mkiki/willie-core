/**
 * @file willie-core - Web server helper
 *
 * This helper is passed to all APIs and views and is a simplified API to handle views, database connectins, and manage errors
 *
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Database = require('wg-database').Database;
const moment = require('moment');
const Auth = require('./auth.js');
const extend = require('extend');

const log = Log.getLogger('willie-core::webHelper');

/** ================================================================================
  * Type definitions
  * ================================================================================ */

/**
 * @typedef DefaultTemplateParameters
 * @property showUser - Do we show the user avatar and menu on the top-right?
 * @property userContext.databaseId - The database identifier (can be used as a key to cache data in local storage, for instance)
 * @property userContext.userContext - 
 * @property userContext.accessToken - The current access token
 * @property userContext.authenticated - Indicates whether the current user is authenticated or not
 * @property userContext.user - 
 * @property userContext.user.uuid - Current user database unique identifier
 * @property userContext.user.login - Current user login
 * @property userContext.user.name - Current user name (human readable)
 * @property userContext.user.isAdmin - Set is the current user is an administrator
 * @property userContext.user.avatar - Current user avatar URL
 * @property userContext.user.email - Current user email
 * @property env - Environment (dev, prod)
 * @property version - Version of the application
 * @property copyright - Copyright string
 * @property mapsAPIKey - Key for google maps API
 * @property sideMenu - Menu items to display in the side menu
 */


/** ================================================================================
  * Web Helper
  * ================================================================================ */

/**
 * @class
 * @property {string} modulePath - The path (filesystem) of the module associated with this helper
 * @property defaultTemplateParameters - Default parameters that will be passed to all JADE templates
 * @property dbFactory - The database factory
 */
WebHelper = function(modulePath, defaultTemplateParameters, dbFactory) {
  this.modulePath = modulePath;
  this.defaultTemplateParameters = defaultTemplateParameters;
  this.userTemplateParameters = {};
  this.dbFactory = dbFactory;
  this.validators = {};
  this.validators['none'] = _validatorString;
  this.validators['string'] = _validatorString;
  this.validators['number'] = _validatorNumber;
  this.validators['boolean'] = _validatorBoolean;
  this.validators['uuid'] = _validatorUUID;
}

/**
 * Set user attributes that will be passed to the JADE templates
 * @param options - is a litteral object which will be set in the user template parameters
 */
WebHelper.prototype.setUserTemplateParameters = function(options) {
  var that = this;
  that.userTemplateParameters = extend(true, {}, that.userTemplateParameters, options);
}

/**
 * Render a web template
 * @param res - is the HTTP response
 * @param {UserContext} userContext - The current user context
 * @param {string} viewName - is the name of the template (in the module's view subdirectory)
 * @param options - is the data to pass to the template
 */
WebHelper.prototype.render = function(res, userContext, viewName, options) {
  var that = this;
  if (viewName !== 'error')
    viewName = that.modulePath + "/views/" + viewName;
  else
    viewName = that.modulePath + "/../../modules/core/views/" + viewName;
  log.info({view:viewName}, "Rendering view");

  // Pass attributes to the JADE template
  // Default template parameters are overwritten by the user template parameters
  // which are overwritten by the user context, and by view-specific data (options)
  var localOptions = {
    userContext: {
      showUser: true
    }
  };
  if (userContext !== null && userContext !== undefined) {
    localOptions = extend(true, localOptions, {
      userContext: {
        showUser:       true,
        accessToken:    userContext.accessToken,
        authenticated:  userContext.authenticated,
        user: {
          uuid:         userContext.user.uuid,
          login:        userContext.user.login,
          name:         userContext.user.name,
          isAdmin:      userContext.user.isAdmin,
          avatar:       userContext.user.avatar,
          email:        userContext.user.email,
        }
      } 
    });
  }
  options = extend(true, {}, that.defaultTemplateParameters, that.userTemplateParameters, localOptions, options);
  log.debug({view:viewName, options:options}, "Rendering view");
  return res.render(viewName, options);
}

/**
 * Run with the context of a database
 *
 * @param req - HTTP request
 * @param res - HTTP response
 * @param {WebHelper~withUserContext_callback} callback - is the return function
 */
WebHelper.prototype.withUserContext = function(req, res, callback) {
  var that = this;
  var userContext = {
    accessToken:    undefined,
    authenticated:  true,
    authError:      undefined,
    isAdmin:        false,
    user: {
      uuid:         'ab8f87ea-ad93-4365-bdf5-045fee58ee3b',
      login:        'nobody',
      name:         'Nobody',
      canLogin:     false,
      avatar:       '/core/images/anonymous.jpg'
    },
    rights: {
      admin:        false,
      auth:         false,
    }
  };

  var accessToken = req.headers[that.getTokenCookieName()];
  if (!accessToken)
    accessToken = req.cookies[that.getTokenCookieName()];

  // No token => this is the special 'nobody' user
  if (!accessToken) {
    return that._checkUserContext(userContext, req, res, callback);
  }

  var authUserContext = { authenticated:true, isAdmin:false, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:false, auth:true} };
  return that.dbFactory.createDatabase(function(err, db) {
    if (err) return callback(new Exception(undefined, "Failed to create database", err));

    // Try authenticating with token
    var credentials = { accessToken:accessToken };

    // Try authenticating
    userContext.accessToken = accessToken;
    userContext.authenticated = false;
    return Auth.authenticate(db, authUserContext, credentials, function(err, session) {
      if (err) {
        // General error
        if (!Auth.isAuthError(err)) return callback(err);
        if (err.code === Auth.  AUTH_ACCESS_TOKEN_EXPIRED) {
          return callback(err);
        }
        // Authentication error
        userContext.authenticated = false;
        userContext.authError = err;
        return that._checkUserContext(userContext, req, res, callback);
      }
      // Authenticated
      userContext.authenticated = true;
      userContext.accessToken = session.accessToken;
      userContext.user = {
        uuid:         session.user.uuid,
        login:        session.user.login,
        name:         session.user.name,
        canLogin:     session.user.canLogin,
        isAdmin:      session.user.isAdmin,
        avatar:       session.user.avatar,
        email:        session.user.email
      }
      if (userContext.user.isAdmin) {
        userContext.isAdmin = true;
        userContext.rights.admin = true;
      }
      return that._checkUserContext(userContext, req, res, callback);
    });
  });
}

WebHelper.prototype._checkUserContext = function(userContext, req, res, callback) {
  var that = this;
  accessToken = userContext.accessToken;
  res.cookie(that.getTokenCookieName(), accessToken, { maxAge: 900000, httpOnly: true })
  log.debug({ userContext:userContext }, "Running with User Context");
  return that.dbFactory.createDatabase(function(err, db) {
    if (err) return callback(new Exception(userContext, "Failed to create database to check user context", err));
    return callback(undefined, db, userContext);
  });
}
/**
 * Callback for the getDatabaseId function. Returns an error and the database identifier
 *
 * @callback WebHelper~withUserContext_callback
 * @param err - is the error code/message
 * @param db - the database object (see willie.Database)
 * @param userContext - the user context object
 *
 * @see getDatabaseId
 */

/**
 * Send result as JSON
 *
 * @param json - The JSON object to return to the user-agent
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebHelper.prototype.sendJSON = function(json, req, res) {
  var that = this;
  log.debug({json:json}, "Result (json)");
  return res.json(json);
};

/**
 * Send result as a file
 *
 * @param fileName - 
 * @param mtime -
 * @param  etag -
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebHelper.prototype.sendFile = function(fileName, mtime, etag, req, res) {
  var that = this;
  log.debug({fileName:fileName}, "Result (file)");
  var lastModified = moment(mtime).utc();

  ifEtag = req.headers['if-none-match'];
  var ifModified = req.headers['if-modified-since'];
  if (ifModified) {
    ifModified = ifModified.replace("GMT", "+0000");
    ifModified = moment(ifModified, "ddd, DD MMM YYYY HH:mm:ss ZZZ");
  }
  
  var cached = false;
  if (ifEtag === etag && ifModified.isValid() && lastModified.isSame(ifModified)) cached = true;
  log.debug({ cached:cached, mtime:mtime, etag:etag, ifEtag:ifEtag, ifModified:ifModified}, "Sending result");

  if (cached) {
    res.status(304).end();
  }
  else {
    var lastModified = lastModified.format("ddd, DD MMM YYYY HH:mm:ss [GMT]");
    return res.sendFile(fileName, {
      dotfiles:           'deny',
      headers: {
        'Cache-Control':  'public, max-age=' + 3600*24*7, // 1 week
        'Last-Modified':   lastModified,
        'Etag':            etag
      }
    });
  }
};


/**
 * Handle an API call error. We distinguish between API error (returning an HTTP status code and message) and View errors (returning an error page)
 * 
 * @param err - The error object or message
 * @param req - HTTP request
 * @param res - HTTP response
 * @param userContext - The current user context
 * 
 * @see WebHelper~handleViewError
 */
WebHelper.prototype.handleAPIError = function(err, req, res, userContext) {
  return this._handleError(err, req, res, userContext, function(httpCode, json) {
    res.status(httpCode).send(json);
  });
}

/**
 * Handle an View display error. We distinguish between API error (returning an HTTP status code and message) and View errors (returning an error page)
 * 
 * @param err - The error object or message
 * @param req - HTTP request
 * @param res - HTTP response
 * @param userContext - The current user context
 * 
 * @see WebHelper~handleAPIError
 */
WebHelper.prototype.handleViewError = function(err, req, res, userContext) {
  var that = this;
  return this._handleError(err, req, res, userContext, function (httpCode, json) {
    res.status(200);
    that.render(res, userContext, 'error', { err: err, userContext: userContext });
  });
}

WebHelper.prototype._handleError = function(err, req, res, userContext, callback) {
  var that = this;
  // Alternative 1: (req, res)
  if (res===undefined) {
    res = req;
    req = err;
    err = undefined;
  }
  // Alternative 2: (err, req, res)

  if (Auth.isAuthError(err)) {
    log.info(err);
    return callback(401, { code:err.code, message:err.message, info:err.info });
  }
  if (Database.isAccessError(err)) {
    log.error(err);
    return callback(401, { message:err.message, info:err.info });
  }
  if (err) log.error(err);
  return callback(500, { message:err.message });
};



/**
 * Parameter validation
 * Functions need to be registered in constuctor
 */

_validatorNone = function(value, defaultValue, callback) {
  if (value === null || value === undefined) return callback(undefined, defaultValue);
  return callback(undefined, value);
}
_validatorString = function(value, defaultValue, callback) {
  if (defaultValue === null || defaultValue === undefined) defaultValue = "";
  if (value === null || value === undefined) return callback(undefined, defaultValue);
  return callback(undefined, value);
}
_validatorNumber = function(value, defaultValue, callback) {
  if (defaultValue) defaultValue = +defaultValue;
  value = +value;
  if (value === undefined || value === null || value !== value) value = defaultValue;
  return callback(undefined, value);
}
_validatorBoolean = function(value, defaultValue, callback) {
  if (defaultValue) defaultValue = !!defaultValue;
  if (value === undefined || value === null) value = defaultValue;
  else if (value === "" || value.toLowerCase() === 'true') value = true;
  else value = false;
  return callback(undefined, value);
}
_validatorUUID = function(value, defaultValue, callback) {
  if (value === undefined || value === null || value.length !== 36 || value[8] != '-' || value[13] !== '-' || value[18] !== '-')
    return callback(new Exception({value:value}, "Failed to validate parameter as a UUID", err));
  return callback(undefined, value);
}

/**
 */
WebHelper.prototype.registerValidator = function(name, validator) {
  this.validators[name] = validator;
}


/**
 * Parameter validation (from HTTP request)
 *
 * params {Array}         An array of parameter names to read / validate
 * req                    The express request
 * callback(err, params)  The return callback. Returns a POJSO with valued parameter names
 *
 * Param formats:
 * <name>[|<"query"|"params">][|filter]
 */
WebHelper.prototype.getParameters = function(params, req, callback) {
  var that = this;
  var result = {};

  log.debug({params:params}, "Getting parameters");

  function _next(index, callback) {
    if (index >= params.length) return callback();
    var p = params[index];
    var tokens = p.split('|');

    var name = tokens.shift();
    var where = 'params';
    var filter = 'none';
    var defaultValue = undefined;

    if (tokens.length > 0) {
      p = tokens.shift();
      if (p === 'query' || p === 'params') {
        if (p === 'query') where = 'query';
        else if (p === 'params') where = 'params';
        p = tokens.shift();
      }
      if (p) {
        var filter = p;
        defaultValue = tokens.shift();
      }
    }
    filter = that.validators[filter];
    var value = req[where][name];

    if (!filter) return callback(new Exception({filter:filter, params:params, param:params[index], index:index}, "Failed to get parameter (invalid filter)"));
    return filter.call(that, value, defaultValue, function(err, validatedValue) {
      if (err) return callback(new Exception({filter:filter, params:params, param:params[index], index:index}, "Failed to get parameter (validator error)", err));
      result[name] = validatedValue;
      return _next(index+1, callback);
    });
  }

  return _next(0, function() {
    log.debug({params:params, result:result}, "Parameters extracted");
    return callback(undefined, result);
  });
};

/**
 * ### Should be in photos
 */
WebHelper.prototype.getTokenCookieName = function() {
  var that = this;
  return that._databaseId + '-willie-token';
}


/**
 * Public interface
 */
module.exports = WebHelper;
