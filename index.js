/**
 * Willie-core - NPM package entry point
 */
// (C) Alexandre Morin 2015 - 2016
  
var Module = require('./lib/module.js');
Module = new Module();
Module.Database = require('./lib/database.js');

/**
 * Module public interface
 */

module.exports = Module;