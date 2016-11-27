/**
 * @file Willie 'core' module - Database access
 *
 * <p>Database access function for the core module. Typically users and session management
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');

const log = Log.getLogger('core:database');


/**
 * @module core/database
 */

/** ================================================================================
  * Type definitions
  * ================================================================================ */

/**
 * @typedef user
 * @property {string} uuid - The unique database identifier (UUID)
 * @property {string} login - The user login
 * @property {string} hashedPassword - The hashed user password
 * @property {string} salt - The salt used to hash the password
 * @property {string} name - The user name (typically first and last name)
 * @property {boolean} canLogin - Indicates if the user can log in or not
 * @property {boolean} isAdmin - Indicates if the user is an administrator
 * @property {string} avatar - An URL (possibly local) to the user's avatar image
 * @property {string} email - The user's email address
 * @property {boolean} builtin - If the user is a built-in user
 */

/**
 * @typedef session
 * @property {Date} now - Current timestamp, in the database refential
 * @property {string} uuid - The session identifier (UUID)
 * @property {string} login - The user login
 * @property {string} accessToken - The user access token
 * @property {Date} validUntil - The session expiration timestamp
 * @property user - Information about the user of this session
 * @property {string} user.uuid - The unique identifier of the user (UUID)
 * @property {string} user.name - The user's name
 * @property {string} user.login - The user's login
 * @property {boolean} user.canLogin - Indicates if the user can log in or not
 * @property {boolean} user.isAdmin - Indicates if the user is an administrator
 * @property {string} user.avatar - An URL (possibly local) to the user's avatar image
 * @property {string} user.email - The user's email address
 */




/** ================================================================================
  * Options
  * ================================================================================ */

/**
 * Get the database identifier.
 * <p>Access rights: requires a user context with admin rights
 *
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 * @param {getDatabaseId_callback} callback - is the return function
 */
getDatabaseId = function(db, userContext, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getDatabaseId requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT value FROM core_options WHERE name='core.databaseId'" ;
    return db.query(client, "getDatabaseId", query, null, function(err, result) {
      if (err) return callback(err);
      var databaseId = result[0].value;
      return callback(null, databaseId);
    });
  }, callback);
};
/**
 * Callback for the getDatabaseId function. Returns an error and the database identifier
 *
 * @callback getDatabaseId_callback
 * @param err - is the error code/message
 * @param dbid - is the database identifier, which is a 36 characters UUID string
 *
 * @see getDatabaseId
 */





/** ================================================================================
  * Users / sessions
  * ================================================================================ */

/**
 * Load several users by their logins.
 * <p>Access rights:
 * <li>Requires a user context
 * <li>admin can load all user
 * <li>non-admin can only load their own user data
 *
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 * @param {string[]} logins - is an array of logins to look for
 * @param {loadUsersByLogins_callback} callback - is the return function
 */
loadUsersByLogins = function(db, userContext, logins, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadUsersByLogins requires a user context"));

  if (logins.length === 0) {
    return callback(null, []);
  }

  return db.withConnection(function(client, callback) {
    var query = "SELECT id, login, hashedPassword, salt, name, canLogin, isAdmin, avatar, email, builtin FROM core_users WHERE login IN("; 
    var bindings = [];
    for (var i=0; i<logins.length; i++) {
      bindings.push(logins[i]);
      if (i>0) query = query + ", ";
      query = query + "$" + (i+1);
    }
    query = query + ")";
    // Apply rights (admin can read everything ; logged user can only load his own data)
    // the "auth" rights allows to read all logins
    if (!userContext.isAdmin && !userContext.rights.auth)
      query = query + " AND id = '" + userContext.user.uuid + "'";
    return db.query(client, "loadUsersByLogins", query, bindings, function(err, result) {
      if (err) return callback(err);
      var users = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var user = {
          uuid:                 row["id"],
          login:                row["login"],
          hashedPassword:       row["hashedpassword"],
          salt:                 row["salt"],
          name:                 row["name"],
          canLogin:             row["canlogin"],
          isAdmin:              row["isadmin"],
          avatar:               row["avatar"],
          email:                row["email"],
          builtin:              row["builtin"]
        }
        users.push(user);
      }
      return callback(null, users);
    });
  }, callback);
}
/**
 * Callback for the loadUsersByLogins function. Returns an error and an array of the users matching the requested logins
 *
 * @callback loadUsersByLogins_callback getDatabaseId_callback
 * @param err - is the error code/message
 * @param {user[]} users - is an array of users matching the requested logins in no particular order
 *
 * @see loadUsersByLogins
 */


/**
 * Load a single user, by login.
 * <p>Access rights:
 * <li>Requires a user context
 * <li>admin can load all user
 * <li>non-admin can only load their own user data
 *
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 * @param {string} login - is an array of logins to look for
 * @param {loadUserByLogin_callback} callback - is the return function
 */
loadUserByLogin = function(db, userContext, login, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadUserByLogin requires a user context"));

  return loadUsersByLogins(db, userContext, [login], function(err, users) {
    if (err) return callback(err);
    if (!users || users.length===0) return callback();
    return callback(null, users[0]);
  });
}
/**
 * Callback for the loadUserByLogin function. Returns an error and a user matching the requested login
 *
 * @callback loadUserByLogin_callback getDatabaseId_callback
 * @param err - is the error code/message
 * @param {user} users - is the user matching the login, or undefined if not found.
 *
 * @see loadUserByLogin
 */
 


/**
 * Update a user's password.
 * <p>Access rights:
 * <li>Requires a user context
 * <li>admin can update all users
 * <li>non-admin can modify their own user
 * 
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 * @param {string} login - is the user login
 * @param {string} salt - is the new salt value
 * @param {string} hashedPassword - is the hashed password value to store
 * @param {updateUserPassword_callback} callback - is the return function
 *
 * @see user
 */
updateUserPassword = function(db, userContext, login, salt, hashedPassword, callback) {
  if (!userContext)
    return callback(db.requiresRights("updateUserPassword requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "UPDATE core_users set salt=$2, hashedPassword=$3 WHERE login=$1"; 
    var bindings = [ login, salt, hashedPassword ];
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND id = '" + userContext.user.uuid + "'";
    return db.query(client, "updateUserPassword", query, bindings, function(err, result) {
      if (err) return callback(err);
      var rowCount = result;
      if (rowCount === 0)
        return callback("No records were updated (maybe login does not exist)");
      return callback();
    });
  }, callback);
}
/**
 * Callback for the updateUserPassword function.
 *
 * @callback updateUserPassword_callback getDatabaseId_callback
 * @param err - is the error code/message
 *
 * @see updateUserPassword
 */



/**
 * Load a session, knowing the access token.
 * <p>Access rights:
 * <li>Requires a user context
 * <li>admin can load all sessions
 * <li>non-admin can only load their own sessions
 * 
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 * @param {string} accessToken - is the access token
 * @param {loadSessionByAccessToken_callback} callback - is the return function
 */
loadSessionByAccessToken = function(db, userContext, accessToken, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadSessionByAccessToken requires a user context"));

  return db.withConnection(function(client, callback) {
    var filter = "s.accesstoken=$1";
    var bindings = [ accessToken ];
    return _loadSession(db, userContext, client, filter, bindings, callback);
  }, callback);
}
/**
 * Callback for the loadSessionByAccessToken function. Returns an error and an array of the users matching the requested logins
 *
 * @callback loadSessionByAccessToken_callback getDatabaseId_callback
 * @param err - is the error code/message
 * @param {session} session - is the session, or undefined if not found
 *
 * @see loadSessionByAccessToken
 */

// Access rights
// - Requires a user context
// - admin can load all sessions
// - non-admin can only load their own sessions
_loadSession = function(db, userContext, client, filter, bindings, callback) {
  if (!userContext)
    return callback(db.requiresRights("_loadSession requires a user context"));

  var query = "SELECT s.id, s.login, s.accessToken, s.validUntil, u.id as uid, u.name as uname, u.canLogin, u.isAdmin, u.avatar, u.email, u.builtin, current_timestamp as now " +
    " FROM core_sessions s, core_users u " +
    " WHERE s.login = u.login ";
  query = query + " AND " + filter;
  
  // Apply rights
  // the "auth" rights allows to read all logins
  if (!userContext.isAdmin && !userContext.rights.auth)
    query = query + " AND u.id = '" + userContext.user.uuid + "'";

  return db.query(client, "_loadSession", query, bindings, function(err, result) {
    if (err) return callback(err);
    if (!result || result.length===0) return callback();
    var row = result[0];
    return callback(null, {
      now:          row["now"],
      uuid:         row["id"],
      login:        row["login"],
      accessToken:  row["accesstoken"],
      validUntil:   row["validuntil"],
      user: {
        uuid:       row["uid"],
        name:       row["uname"],
        login:      row["login"],
        canLogin:   row["canlogin"],
        isAdmin:    row["isadmin"],
        avatar:     row["avatar"],
        email:      row["email"],
        builtin:    row["builtin"]
      }
    });
  });
}

/**
 * Insert a new session.
 * Access rights: requires a valid user context
 * 
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 * @param {string} login - is the user login
 * @param {string} accessToken - is the access token
 * @param {int} expireInSeconds - is the number of seconds in which the session ewpires
 * @param {insertSession_callback} callback - is the return function
 */
insertSession = function(db, userContext, login, accessToken, expireInSeconds, callback) {
  if (!userContext)
    return callback(db.requiresRights("insertSession requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "INSERT INTO core_sessions (login, accessToken, validUntil) VALUES ($1, $2, current_timestamp + interval '" + parseInt(expireInSeconds, 10) + " second')";
    var bindings = [ login, accessToken ];
    return db.query(client, "insertSession", query, bindings, function(err, result) {
      if (err) return callback(err);
      var filter = "s.accesstoken=$1";
      var bindings = [ accessToken ];
      return _loadSession(db, userContext, client, filter, bindings, function(err, session) {
        return callback(err, session);
      });
    });
  }, callback);
}
/**
 * Callback for the insertSession function. Returns an error and the updated session object
 *
 * @callback insertSession_callback getDatabaseId_callback
 * @param err - is the error code/message
 * @param {session} session - is the session with updated attributes
 *
 * @see insertSession
 */



/**
 * Add a user
 */ 
addUser = function(db, userContext, login, name, email, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getDatabaseId requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "INSERT INTO core_users (login, name, email, canLogin) VALUES ($1, $2, $3, true)" ;
    return db.query(client, "addUser", query, [login, name, email], function(err, result) {
      if (err) return callback(err);
      return callback(null);
    });
  }, callback);
}


/** ================================================================================
  * Jobs
  * ================================================================================ */

/**
 * Insert a new job.
 * Access rights: requires a valid user context
 * 
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 */
insertJob = function(db, userContext, job, callback) {
  if (!userContext)
    return callback(db.requiresRights("insertJob requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "INSERT INTO core_jobs (id, name, type, status, context, progress, started, updated) VALUES ($1, $2, $3, $4, $5, NULL, current_timestamp, current_timestamp)";
    var bindings = [ job.id, job.name, job.type, job.status, job.context ];
    return db.query(client, "insertJob", query, bindings, function(err, result) {
      if (err) return callback(err);
      return callback(undefined);
    });
  }, callback);
}

/**
 * Update a job's progress
 * Access rights: requires a valid user context
 * 
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 */
updateJobProgress = function(db, userContext, jobUUID, status, progress, callback) {
  if (!userContext)
    return callback(db.requiresRights("updateJobProgress requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "UPDATE core_jobs SET status=$2, progress=$3, updated=current_timestamp WHERE id=$1";
    var bindings = [ jobUUID, status, progress ];
    return db.query(client, "updateJobProgress", query, bindings, function(err, result) {
      if (err) return callback(err);
      return callback(undefined);
    });
  }, callback);
}

/**
 * Get recently modified jobs
 *
 * @param db - is the database object (see willie.Database)
 * @param userContext - is the execution context, containing user, credentials...
 */
getRecentlyModifiedJobs = function(db, userContext, callback) {
  /*
    if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getRecentlyModifiedJobs requires admin rights"));
  */
  return db.withConnection(function(client, callback) {
    var query = "SELECT id, name, type, status, context, progress, started, updated FROM core_jobs WHERE updated IS NOT NULL ORDER BY updated DESC LIMIT 100" ;
    return db.query(client, "getRecentlyModifiedJobs", query, null, function(err, result) {
      if (err) return callback(err);
      var jobs = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var job = {
          uuid:       row["id"],
          name:       row["name"],
          type:       row["type"],
          status:     row["status"],
          context:    row["context"],
          progress:   row["progress"],
          started:    row["started"],
          updated:    row["updated"]
        }
        jobs.push(job);
      }
      return callback(undefined, jobs);
    });
  }, callback);
};


/**
 * Public interface
 * @ignore
 */
module.exports = {
  getDatabaseId:              getDatabaseId,
  loadUsersByLogins:          loadUsersByLogins,
  loadUserByLogin:            loadUserByLogin,
  updateUserPassword:         updateUserPassword,
  loadSessionByAccessToken:   loadSessionByAccessToken,
  insertSession:              insertSession,
  addUser:                    addUser,
  insertJob:                  insertJob,
  updateJobProgress:          updateJobProgress,
  getRecentlyModifiedJobs:    getRecentlyModifiedJobs
};


