/**
 * @file Willie 'core' module - Module configuration
 *
 * <p>Database access function for the core module. Typically users and session management
 */
// (C) Alexandre Morin 2016

/**
 * @module core/config
 */

/**
 * @typedef config
 * @property {string} name - Module name (camel-case, no spaces)
 * @property {string} path - Module path (on file system)
 * @property {string} version - Module version (major.minor.micro)
 * @property {menuItem[]} homeMenu - list of menu items to insert on the application home page (/). The index attribute is used to control the display order
 * @property {menuItem[]} sideMenu - list of menu items to insert on the left-side menu. The index attribute is used to control the display order
 */

/**
 * @typedef menuItem
 * @property {string} name - Menu identifier (camel-case, no spaces)
 * @property {string} label - Menu title (human readable)
 * @property {string} href - Link to navigate to when clicking menu
 * @property {string} icon - Menu icon (svg 24x24)
 * @property {string} index - Menu index, used to determine in which order to display menu items relative one to another
 */


const defaultConfig = {
  name: "core",
  path: __dirname + "/..",
  version: "1.2.0",
  homeMenu: [
  ],
  sideMenu: [
    { name:"core:help",   label:"Help",   href:"/help.html",  icon:"/core/images/help.svg",   index:9999 }
  ]
};

function _checkConfig(config, callback) {
  return callback(undefined, config);
}


/**
 * Public interface
 * @ignore
 */
module.exports = {
  defaultConfig: defaultConfig,
  check: _checkConfig
}

