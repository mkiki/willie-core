# Willie core module

This module provides core functionality
* Shared database structure
* Users and session management (authentication)
* Notion of module, background commands and web services
* Helpers for other modules

## Installation

	npm link wg-log
	npm link wg-utils
	npm link wg-database
	npm install


## Database

The core module provides the following database entities

* Options (```core_options```) which are just key-value pairs
* Users (```core_users```) 
* Sessions (```core_sessions```)
* Long running jobs (```core_jobs```)


## Commands

* ```web``` - Starts the web server (and all modules)
* ```stop``` - Stops the web server
* ```addUser``` - Creates a user in the system
* ```password``` - Sets / change a user password


## APIs

### Log a user in

	type: 'POST'
	url: '/login'
	data: { login:login, password:password }
	dataType: 'json'

### Log a user out

	type: 'POST'
	url: '/logout'
	data: { }
	dataType: 'json'

### Get statistics on the application

    type: 'GET'
    url: '/stats'
    dataType: 'json

Will return general statistics on the application as well as for each installed module.
The returned structure is keyed by the module name

	{
	  "core": {
	    "databaseId": "d80d301d-9bc4-4271-ad55-e9e8181b6e52"
	  },
	  "module#1": {
	    ...
	  ...
	}
  
### Get recently modified jobs
Returns an array with the 100 jobs modified the most recently, order by decreasing update date.

    type: 'GET',
    url: '/jobs',
    dataType: 'json',


## Pages

### Home page

	url: '/'

### Help page

	url: '/help.html'

### Jobs page

	utl: '/jobs.html'


## Changelog

1.3.0 - Cleanup, push to github

1.2.2 - Refactored the 'start' and configuration

