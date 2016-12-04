/**
 * @file willie-core - Authentication
 *
 * <p>Server-side functions managing authentication, tokens, sessions, passwords.
 */
// (C) Alexandre Morin 2016

/**
 * @module core/auth
 */

const crypto = require('crypto');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;

const database = require('./database.js');

const log = Log.getLogger('willie-core::auth');

/** ================================================================================
  * Type definitions
  * ================================================================================ */

/**
 * @typedef AccessTokenCredentials
 * @property {string} accessToken - The access token
 */

/**
 * @typedef LoginPasswordCredentials
 * @property {string} login - The user login
 * @property {string} password - The user password
 */



/** ================================================================================
  * Token Management
  * ================================================================================ */
/** @ignore */
ACCESS_TOKEN_EXPIRES_SECONDS = 60*60; // 1h
ACCESS_TOKEN_REFRESH_BEFORE = 50*60;  // 10 mins (refresh token 10 mins before it expires)

/** ================================================================================
  * Authentication error management
  * ================================================================================ */
/** @ignore */
var AUTH_CANNOT_LOGIN = 10;             // user is not allowed to log in
var AUTH_USER_NOT_FOUND = 11;           // user (login) does not exit
var AUTH_INVALID_PASSWORD = 12;         // password was not valid
var AUTH_ACCESS_TOKEN_EXPIRED = 13;     // session token expired
var AUTH_ACCESS_TOKEN_NOT_FOUND = 14;   // access token not in db


function AuthError(code, message, info) {
  this.code = code;
  this.message = message;
  this.info = info;
}

/**
 * Determine if an error is an authentication error.
 *
 * @param err - is the error object or string
 * @return {boolean} indicating whether the error is an authentication error or not
 */
function isAuthError(err) {
  if (!err) return false;
  return err instanceof AuthError;
}

/** ================================================================================
  * Cryptographic helpers
  * ================================================================================ */
/** @ignore */
function salt() {
  var buf = crypto.randomBytes(32).toString('hex');
  return buf;
}
function sha256(s) {
  var shasum = crypto.createHash('sha256');
  shasum.update(s);
  return shasum.digest('hex');
}
function createAccessToken() {
  var buf = crypto.randomBytes(256).toString('hex');
  return buf; 
}


/** ================================================================================
  * Password management
  * ================================================================================ */

/**
 * Change a user's password
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {string} login - is the user's login for which to change the password
 * @param {string} password - is the new password
 * @param {changePassword_callback} callback - is the return function
 */
function changePassword(db, userContext, login, password, callback) {
  if (!password || password.length===0) {
    return callback(new AuthError(AUTH_INVALID_PASSWORD, "Empty password not allowed"));
  }
  var s = salt();
  var hashed = sha256(s + password);
  return database.updateUserPassword(db, userContext, login, s, hashed, function(err) {
    return callback(err);
  });
}
/**
 * Callback for the changePassword function.
 *
 * @callback changePassword_callback
 * @param err - is the error code/message
 */


/** ================================================================================
  * Authentication
  * ================================================================================ */

/**
 * Authenticate with credentials
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {LoginPasswordCredentials|AccessTokenCredentials} credentials - is the credentials
 * @param {authenticate_callback} callback - is the return function
 *
 * @see LoginPasswordCredentials
 * @see AccessTokenCredentials
 */
function authenticate(db, userContext, credentials, callback) {
  if (credentials.accessToken)
    return _authenticateWithAccessToken(db, userContext, credentials.accessToken, callback);
  if (credentials.login)
    return _authenticateWithLoginPassword(db, userContext, credentials.login, credentials.password, callback);
  return callback("Invalid credentials");
}
/**
 * Callback for the authenticate function.
 *
 * @callback authenticate_callback
 * @param err - is the error code/message
 * @param {database.session} session - a session object if authentication was successful
 */

function _authenticateWithAccessToken(db, userContext, accessToken, callback) {
  log.debug({ accessToken:accessToken }, "Authenticating");
  return database.loadSessionByAccessToken(db, userContext, accessToken, function(err, session) {
    if (err) return callback(err);
    if (!session) {
      log.debug({ accessToken:accessToken}, "Access token not found");
      return callback(new AuthError(AUTH_ACCESS_TOKEN_NOT_FOUND, "Access token not found", { accessToken:accessToken }));
    }
    return _checkSession(db, userContext, session, function(err, newSession) {
      return callback(err, newSession);
    });
  });
}

function _checkSession(db, userContext, session, callback) {
  var accessToken = session.accessToken;
  if (!session.user.canLogin) {
    log.debug({ session:session}, "User is not allowed to log in");
    return callback(new AuthError(AUTH_CANNOT_LOGIN, "User is not allowed to log in", { accessToken:accessToken, user:session.user }));
  }
  if (session.validUntil <= session.now) {
    log.debug({ session:session}, "Access Token expired");
    return callback(new AuthError(AUTH_ACCESS_TOKEN_EXPIRED, "Access Token expired", { accessToken:accessToken, user:session.user }));
  }
  log.debug({ session:session }, "Logged in (with access token)");
  return _refresh(db, userContext, session, function(err, newSession) {
    return callback(err, newSession);
  });
}

function _authenticateWithLoginPassword(db, userContext, login, password, callback) {
  return database.loadUserByLogin(db, userContext, login, function(err, user) {
    if (err) return callback(err);
    if (!user) return callback(new AuthError(AUTH_USER_NOT_FOUND, "User not found", { login:login }));
    if (!user.canLogin) {
      log.debug({ user:user }, "User is not allowed to log in");
      return callback(new AuthError(AUTH_CANNOT_LOGIN, "User is not allowed to log in", { user:user }));
    }
    var s = user.salt;
    var hashed = sha256(s + password);
    if (hashed !== user.hashedPassword) {
      return callback(new AuthError(AUTH_INVALID_PASSWORD, "Invalid password", { login:login }));
    }
    var accessToken = createAccessToken();
    return database.insertSession(db, userContext, login, accessToken, ACCESS_TOKEN_EXPIRES_SECONDS, function(err, session) {
      if (err) return callback(err);
      log.debug({ session:session}, "Logged in (with password)");
      return callback(null, session);
    });
  });
}

function _refresh(db, userContext, session, callback) {
  var refreshLimit = new Date(); refreshLimit.setTime(session.validUntil.getTime() - ACCESS_TOKEN_REFRESH_BEFORE*1000); // when do we need to refresh?
  if (session.now < refreshLimit) return callback(null, session);
  // Do not bother to update: create a new session
  var newAccessToken = createAccessToken();
  return database.insertSession(db, userContext, session.login, newAccessToken, ACCESS_TOKEN_EXPIRES_SECONDS, function(err, newSession) {
    if (err) return callback(err);
    log.debug({ session:newSession, oldSession:session }, "Session refreshed");
    return callback(null, newSession);
  });
}


/**
 * Public interface
 * @ignore
 */
 module.exports = {
  authenticate:                 authenticate,
  changePassword:               changePassword,
  isAuthError:                  isAuthError,

  AUTH_CANNOT_LOGIN:            AUTH_CANNOT_LOGIN,
  AUTH_USER_NOT_FOUND:          AUTH_USER_NOT_FOUND,
  AUTH_INVALID_PASSWORD:        AUTH_INVALID_PASSWORD,
  AUTH_ACCESS_TOKEN_EXPIRED:    AUTH_ACCESS_TOKEN_EXPIRED,
  AUTH_ACCESS_TOKEN_NOT_FOUND:  AUTH_ACCESS_TOKEN_NOT_FOUND,
};


