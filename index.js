/**
 * Willie-core - NPM package entry point
 */
// (C) Alexandre Morin 2015 - 2016
  
var Module = require('./lib/module.js');
var Database = require('./lib/database.js');

/**
 * Module public interface
 */
module.exports = {
  Module: new Module(),
  Database: Database,

  // Test interface. Returns the object as a function so that there's no overhead if not using
  Test: function() {
    const helpers = require('./tests/helpers.js');
    return helpers;
  }

};

