/**
 * wg-database - Test utils / helpers
 */
// (C) Alexandre Morin 2015 - 2016

const utils = require('wg-utils');
const Database = require('wg-database').Database;
const extend = require('extend');
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
var Module = require('../lib/module.js');
var willieCoreModule = new Module();

const log = Log.getLogger('willie-core::database::test');

const DBNAME = "willietest";
const DBUSER = "willie";
const DBPASS = "willie";

const ADMINCNX = "postgres://postgres@localhost/postgres";
const ADMINCNX2 = "postgres://postgres@localhost/" + DBNAME;
const CNX = "postgres://" + DBUSER + ":" + DBPASS + "@localhost/" + DBNAME;

var db = new Database(CNX);

// Wrappers to run functions with different sets of credentials
asNobody = function(callback)       { var userContext = { authenticated:true, isAdmin:false, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:false} };  return callback(db, userContext); };
asAlexAdmin = function(callback)    { var userContext = { authenticated:true, isAdmin:true,  user:{uuid:'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea'}, rights:{admin:true}  };  return callback(db, userContext); };

recreateDatabase = function(dbname, dbuser, callback) {
  var adminDB = new Database(ADMINCNX);
  var adminDB2 = new Database(ADMINCNX2);

  var adminContext = { authenticated:true, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:true} };
  return asNobody(function(db, adminContext) {
    log.info("Recreating database");
    return adminDB.executeSQL(adminContext, [
      "DROP DATABASE IF EXISTS " + dbname,
      "CREATE DATABASE " + dbname + " LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8'",
    ], function(err) {
      if (err) return callback(err);

      return adminDB2.executeSQL(adminContext, [
        "GRANT ALL PRIVILEGES ON DATABASE " + dbname + " TO " + dbuser,
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
      ], function(err) {
        if (err) return callback(err);

        log.info("Database created");
        return willieCoreModule.loadTextFile('sql/update.sql', function(err, update) {
          if (err) return callback(new Exception({module:module.moduleConfig.name}, "Failed to load update.sql file from module", err));
          return willieCoreModule.loadTextFile('sql/data.sql', function(err, data) {
            if (err) return callback(new Exception(undefined, "Failed to load data.sql file from module", err));
            var commands = [
              update,
              data,
              "INSERT INTO core_users (id, login, name, canLogin) VALUES ('dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea',   'alex',     'Alexandre Morin',  true)",
            ];
            return db.executeSQL(adminContext, commands, function(err) {
              if (err) return callback(new Exception(undefined, "Failed to execute the database SQL update scripts of module", err));
              return callback();
            });
          });
        });
      });
    });
  });
}


/**
 * Database setup
 */

// Called once before executing tests
before(function(done) {
   this.timeout(15000);
  return recreateDatabase(DBNAME, DBUSER, function(err) {
     return done(err);
  });
});

// Called once after executing tests
after(function(done) {
  return Database.shutdown(function(err, stats) {
    if (err) log.warn({err:err}, "Failed to shutdown database");
    return done();
  });
});

// Executed before each test
beforeEach(function(done) {
  return asNobody(function() {
    done();
  });
});


/** ================================================================================
  * Public interface
  * ================================================================================ */
module.exports = {
  cnx:                CNX,
  db:                 db,
  asNobody:           asNobody,
  asAlexAdmin:        asAlexAdmin
};
