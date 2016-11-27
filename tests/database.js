  /**
   * Willie - Database unit tests
   *
   * (C) Alexandre Morin 2015 - 2016
   */
const assert = require('assert');
const helpers = require('./helpers.js');
const database = require('../lib/database.js');



describe('Database', function() {


  /** ================================================================================
    * Users
    * ================================================================================ */

  describe('Users', function() {

    var crypto = require('crypto');
    function genSaltAndHashedPassword(pwd) {
      var salt = crypto.randomBytes(32).toString('hex');    
      var shasum = crypto.createHash('sha256');
      shasum.update(pwd);
      var hashed = shasum.digest('hex');
      return [salt, hashed];
    }

    it('Should load user by login', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return database.loadUserByLogin(db, userContext, 'nobody', function(err, user) {
          if (err) return done(err);
          assert(user, "User not found");
          return done();
        });
      });
    });

    it('Should load user by login', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        // Admin can load anoyone
        return database.loadUserByLogin(db, userContext, 'nobody', function(err, user) {
          if (err) return done(err);
          assert(user, "User not found");
          return database.loadUserByLogin(db, userContext, 'alex', function(err, user) {
          if (err) return done(err);
          assert(user, "User not found");
            return done();
          });
        });
      });
    });

    it('Should load users', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return database.loadUsersByLogins(db, userContext, ['nobody', 'alex'], function(err, users) {
          if (err) return done(err);
          assert.equal(users.length, 1, "User not found");
          // As admin, should return all users
          return helpers.asAlexAdmin(function(db, userContext) {
            return database.loadUsersByLogins(db, userContext, ['nobody', 'alex'], function(err, users) {
              if (err) return done(err);
              assert.equal(users.length, 2, "User not found");
              return done();
            });
          });
        });
      });
    });

    it('Should not fail when asked to load no users', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return database.loadUsersByLogins(db, userContext, [], function(err, users) {
          if (err) return done(err);
          assert.equal(users.length, 0);
          return done();
        });
      });
    });

    it('Should update password', function(done) {
      return helpers.asNobody(function(db, userContext) {
        var saltAndHashed = genSaltAndHashedPassword('nobody');
        return database.updateUserPassword(db, userContext, 'nobody', saltAndHashed[0], saltAndHashed[1], function(err) {
          if (err) return done(err);
          // Check
          return database.loadUserByLogin(db, userContext, 'nobody', function(err, user) {
            if (err) return done(err);
            assert.equal(user.salt, saltAndHashed[0]);
            assert.equal(user.hashedPassword, saltAndHashed[1]);
            return done();
          });
        });
      });
    });

  });

});


