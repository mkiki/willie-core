/**
 * Photo Organiser - Authorization unit tests
 *
 * (C) Alexandre Morin 2015 - 2016
 */

var assert = require('assert');

describe('Auth', function() {
  
  const Auth = require('../lib/auth.js');
  const assert = require('assert');
  const helpers = require('./helpers.js');
  const database = require('../lib/database.js');
  

  /** ================================================================================
    * Test password authentication
    * ================================================================================ */

  describe('Password authentication', function() {

    it('Should authenticate with password', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return Auth.changePassword(db, userContext, "alex", "togodo", function(err) {
          if (err) return done(err);
          return Auth.authenticate(db, userContext, {login:"alex", password:"togodo"}, function(err, session) {
            if (err) return done(err);
            assert(session.uuid);
            assert(session.accessToken);
            return done();
          });
        });
      });
    });

    it('Should fail to authenticate with invalid password', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return Auth.changePassword(db, userContext, "alex", "togodo", function(err) {
          if (err) return done(err);
          return Auth.authenticate(db, userContext, {login:"alex", password:"tugudu"}, function(err, session) {
            assert(Auth.isAuthError(err), "Call to 'authenticate' with bad password should have failed");
            return done();
          });
        });
      });
    });

    it('Should change password', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        // Authenticate
        return Auth.changePassword(db, userContext, "alex", "togodo", function(err) {
          if (err) return done(err);
          return Auth.authenticate(db, userContext, {login:"alex", password:"togodo"}, function(err, session) {
            if (err) return done(err);
            assert(session.uuid);
            assert(session.accessToken);
            // Change password
            return Auth.changePassword(db, userContext, "alex", "tugudu", function(err) {
              if (err) return done(err);
              // Authenticate with new password
              return Auth.authenticate(db, userContext, {login:"alex", password:"tugudu"}, function(err, session) {
                if (err) return done(err);
                assert(session.uuid);
                assert(session.accessToken);
                // Authenticate with old password
                return Auth.authenticate(db, userContext, {login:"alex", password:"togodo"}, function(err, session) {
                  assert(Auth.isAuthError(err), "Call to 'authenticate' with bad password should have failed");
                  return done();
                });
              });
            });
          });
        });
      });
    });

    it('Should fail to set empty password', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return Auth.changePassword(db, userContext, "alex", "", function(err) {
          assert(Auth.isAuthError(err), "Call to 'changePassword' with empty password should have failed");
          assert.equal(err.code, Auth.AUTH_INVALID_PASSWORD);
          return done();
        });
      });
    });

    it('Should not login as invalid user', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return Auth.authenticate(db, userContext, {login:"bibb", password:"togodo"}, function(err, session) {
          assert(Auth.isAuthError(err), "Call to 'authenticate' should fail with invalid user");
          assert.equal(err.code, Auth.AUTH_USER_NOT_FOUND);
          return done();
        });
      });
    });

    it('Should not allow users which can\'t login', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return db.executeSQL(userContext, [ "INSERT INTO core_users (id, login, name, canLogin) VALUES ('01f53394-da14-4b7c-bd8f-96822f72529c', 'alien', 'Alien', false)" ], function(err) {
          if (err) return done(err);
          return Auth.changePassword(db, userContext, "alien", "togodo", function(err) {
            if (err) return done(err);
            return Auth.authenticate(db, userContext, {login:"alien", password:"togodo"}, function(err, session) {
              assert(Auth.isAuthError(err), "Call to 'authenticate' should fail because user is not allowed to log in");
              assert.equal(err.code, Auth.AUTH_CANNOT_LOGIN);
              return done();
            });
          });
        });
      });
    });

  });

  /** ================================================================================
    * Test session authentication
    * ================================================================================ */

  describe('Session authentication', function() {

    it('Should authenticate with session', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return Auth.changePassword(db, userContext, "alex", "togodo", function(err) {
          if (err) return done(err);
          return Auth.authenticate(db, userContext, {login:"alex", password:"togodo"}, function(err, session) {
            if (err) return done(err);
            assert(session.uuid);
            assert(session.accessToken);

            var accessToken = session.accessToken;
            return Auth.authenticate(db, userContext, {accessToken:accessToken}, function(err) {
              if (err) return done(err);
              assert.ok(true);
              return done();
            });
          });
        });
      });
    });

    it('Should not authenticate with invalid token', function(done) {
      helpers.asNobody(function(db, userContext) {
        var accessToken = "aec78d0007e956f43b515338abebc79b0f035f8407ec61684906bafa517d3398f8339a9b45e29e90394d51080fce2840845d7c010cdb851e9857c4af88f4daff12baa192e4ded4f169d6cf91c1fda40930166f45143cbf83639628f39909ef023ad626bc7608a60a14c734d32330d572a4d74ab53825005a8d7c8d12c057abdac39ef8dbd5f11a95b15d103bc8e9ed7350ab11efaba205ec9cb52deaf166a52f06254402a2a94d3d3c57dbdf3af6be2cc8f3452a3897cfdc5368ff8910b56a01539604709b7d9c989ab4df20ff27c897e210607e116ce59d62c396406014e3a8663fd227a76cbfc970da89173e707a15987034b8e71aee0e0e96fce3f8f0367e";
        return Auth.authenticate(db, userContext, {accessToken:accessToken}, function(err) {
          assert(Auth.isAuthError(err), "Call to 'authenticate' should fail with invalid session token");
          assert.equal(err.code, Auth.AUTH_ACCESS_TOKEN_NOT_FOUND);
          return done();
        });
      });
    });

    it('Should not authenticate with expired session', function(done) {
      helpers.asAlexAdmin(function(db, userContext) {
        return Auth.changePassword(db, userContext, "alex", "togodo", function(err) {
          if (err) return done(err);
          return Auth.authenticate(db, userContext, {login:"alex", password:"togodo"}, function(err, session) {
            if (err) return done(err);
            assert(session.uuid);
            assert(session.accessToken);
            var accessToken = session.accessToken;
            return Auth.authenticate(db, userContext, {accessToken:accessToken}, function(err) {
              if (err) return done(err);
              assert.ok(true);
              // Force expiration
              return db.executeSQL(userContext, [
                "UPDATE core_sessions SET validUntil=current_timestamp - interval '1 second' WHERE accessToken='" + accessToken + "'"
                ], function() {
                return Auth.authenticate(db, userContext, {accessToken:accessToken}, function(err) {
                  assert(Auth.isAuthError(err), "Call to 'authenticate' should fail with expired session token");
                  assert.equal(err.code, Auth.AUTH_ACCESS_TOKEN_EXPIRED);
                  return done();
                });
              });
            });
          });
        });
      });
    });

  });

});
