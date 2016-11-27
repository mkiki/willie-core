/**
 * Core module - Module tests
 *
 * (C) Alexandre Morin 2015 - 2016
 */

var assert = require('assert');

describe('Module', function() {

  const fs = require('fs');  
  const Module = require('../lib/module.js');
  const WebServer = require('../lib/webServer.js');
  const Exception = require('wg-log').Exception;
  const http = require('http');
  const helpers = require('./helpers.js');

  const CNX = helpers.cnx; //"postgres://willie:willie@localhost/willietest";

  // Execute a block of code in between module start and shutdown
  // Call callback after module shutdown
  function _withModule(block, callback) {
    var module = new Module();
    var moduleConfigFile = __dirname + "/./data/module-config.json";
    return fs.readFile(moduleConfigFile, 'utf8', function(err, data) {
      if (err) return callback(err);
      var moduleConfig = JSON.parse(data);
      return module.start({}, moduleConfig, [], function(err) {
        if (err) return callback(err);
        return block(module, function(err) {
          return module.shutdown(function(err2) {
            if (err2) console.warn("Failed to shutdown module", err2);
            return callback(err);
          });        
        });
      });
    });
  }


  describe('Module Life Cycle', function() {

    it('Should start & stop', function(done) {
      var module = new Module();
      return module.start({}, __dirname + "/./data/module-config.json", [], function(err) {
        assert (err === null || err === undefined,                            "Checking for error at start");
        return module.shutdown(function(err) {
          assert (err === null || err === undefined,                          "Checking for error at shutdown");
          return done();
        });
      });
    });

    it('Should return help string', function(done) {
      return _withModule(function(module, callback) {
        var help = module.getHelpString();
        assert (help && help.length > 0);
        return callback();
      }, done);
    });

    it('Should access config', function(done) {
      return _withModule(function(module, callback) {
        var conf = module.moduleConfig;
        assert (conf !== null && conf !== undefined, "Checking configuration");
        assert (conf.name === 'core', "Checking module name in configuration");
        return callback();
      }, done);
    });

    it('Should load text file', function(done) {
      return _withModule(function(module, callback) {
        return module.loadTextFile('sql/update.sql', function(err, contents) {
          assert (err === null || err === undefined, "Checking for error");
          var row = contents.substr(84, 32);
          assert (row === 'Core - Update database structure', "Checking a piece of content near the beginning");
          return callback();
        });
      }, done);
    });

  });




  // Execute a block of code in between module web start and shutdown
  // Call callback after module shutdown
  function _withModuleWebService(block, callback) {
    return _withModule(function(module, callback) {
      var config = { cnx:CNX, web:{port:3000} };
      var webServer = new WebServer(config);
      return webServer.start(function(err) {
        if (err) return callback(new Exception(undefined, "Checking for error (starting web server)", err));
        return webServer.startModule(module, function(err) {
          if (err) return callback(new Exception(undefined, "Checking for error (starting web service of module)", err));
          webServer.setUserTemplateParameters(module, { homeMenu:[], sideMenu:[] });
          return block(module, function(err) {
            return webServer.shutdown(function(err2) {
              if (err2) console.warn("Failed to shutdown web server", err2);
              return callback(err);
            });
          });
        });
      });
    }, callback);
  };


  // Execute HTTP request (returns text)
  function _httpGet(url, callback) {
    return http.get(url, function(res) {
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function(d) { body += d; });
      res.on('end', function() { return callback(undefined, body); });
      res.on('error', function(err) { return callback(new Exception({url:url}, "Failed to execute HTTP request", err)); });
    });
  }

  describe('Module Web Service', function() {
    it('Should start web', function(done) {
      return _withModuleWebService(function(module, callback) {
        return _httpGet('http://localhost:3000/', function(err, data) {
          return callback();
        });
      }, done);
    });
  });



});
