/**
 * willie-core - Client-side utilities
 */
// (C) Alexandre Morin 2015 - 2016

// Keyboard codes
KEY_ESCAPE = 27;
KEY_RETURN = 13;
KEY_LEFT_ARROW = 37;
KEY_RIGHT_ARROW = 39;

/** ================================================================================
  * Utilities
  * ================================================================================ */

// Test if an object is an array
isArray = function (obj) {
  if( obj === null || obj === undefined )
    return false;
  return obj.constructor === [].constructor;
};

// Test if an object is an javasctipt native date
isDate = function(obj) {
  return toString.call(obj) === '[object Date]';
}

// Test if an object is a JS object
isObject = function(obj) {
  var type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
};

// Format a number to be displayed as a size (number of bytes)
function formatSize(bytes) {
  if (bytes < 1024) return "" + bytes + " b";
  bytes = Math.floor(bytes/512)/2;
  if (bytes < 1024) return "" + bytes + " Kb";
  bytes = Math.floor(bytes/512)/2;
  return "" + bytes + " Mb";
}

// Return a request URL parameter
function getUrlParameter(name){
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
  if (!results || results.length<2) return undefined;
  return results[1];
}

/** ================================================================================
  * UI utilities
  * ================================================================================ */

// Test for infinite scrolling
function isElementInScroll(elem) {
  var docViewTop = $(window).scrollTop();
  var docViewBottom = docViewTop + $(window).height();
  
  if ($(elem).offset() === undefined) return false;

  var elemTop = $(elem).offset().top;
  var elemBottom = elemTop + $(elem).height();

  return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}

/**
 * Run a function, and display a wait dialog if function takes too long (more than .5 seconds)
 * @param run is the function to execute. This is an async function, in the node.js sense (first argument is the return callback)
 * @param $body is the page element on which to display the wait dialog (centered)
 * @param callback is called when the 'run' function is finished, passing the run function result as parameters
 *
 * Example

    var $body = $('body');
  
    runWithWait(

      function(callback) {
        console.log("Starting request");  
        setTimeout(function() {
          console.log("Done");
          return callback(2);
        }, 5000);
      },

      $body,

      function(a) {
        console.log("Finished", a);
      }
    );

 *
 */
function runWithWait(run, $body, callback) {
  var running = true; // function is running
  var $wait = undefined; // wait component

  // Show timeout after .5 second, centered in $body
  setTimeout(function() {
    if (running) {
      $('.nav-wait').remove();
      var width = $body.width();
      var height = $body.height();
      $wait = $('<img class="nav-wait" src="images/wait-630.gif"></img>');
      $wait.css({
        position: 'absolute',
        top: (height-80)/2,
        left: (width-80)/2,
        width: 80,
        height: 80,
        zIndex: 5000
      });
      $wait.appendTo($body);
    }
  }, 500);

  // Execute function
  run.call(this, function() {
    var args = arguments;
    running = false;
    $('.nav-wait').remove();
    return callback.apply(this, args);
  });

}

/** ================================================================================
  * Local storage
  * ================================================================================ */

// Constructor
var ConfigurationManager = function() {
}

// Get a JSON value from local storage
ConfigurationManager.prototype._localGetItem = function(name) {
  var that = this;
  name = that._getLocalStorageKey(name);
  var value = localStorage.getItem(name);
  if (!value) return value;
  try {
    value = JSON.parse(value);
  } catch(ex) {
    return undefined;
  }
  return value;
}

// Store a JSON value in local storage
ConfigurationManager.prototype._localSetItem = function(name, value) {
  var that = this;
  name = that._getLocalStorageKey(name);
  if (value) value = JSON.stringify(value);
  return localStorage.setItem(name, value);
}

// Compute a local storage key
ConfigurationManager.prototype._getLocalStorageKey = function(key) {
  var databaseId = document.userContext.databaseId;
  return "photos.loulex.com." + databaseId + "." + key;
}


ConfigurationManager.prototype.loadUserContext = function(userContext) {
  var that = this;
  var userContext = that._localGetItem("userContext");
  return userContext;
}

ConfigurationManager.prototype.saveUserContext = function(userContext) {
  var that = this;
  that._localSetItem("userContext", userContext);
}

ConfigurationManager.prototype.loadUser = function(login) {
  var that = this;
  var user = that._localGetItem("user." + login);
  return user;
}

ConfigurationManager.prototype.saveUser = function(login, user) {
  var that = this;
  that._localSetItem("user." + login, user);
}


/** ================================================================================
  * SVG icons
  * ================================================================================ */

// Show/hide hamburger menu
var hamburgerOpen = false;
function _toggleHamburger(forceShowHide) {
  if ((forceShowHide===undefined && !hamburgerOpen) || forceShowHide===true) {
    hamburgerOpen = true;
    $(".menu").animate({width:260}, 100, function() {
      $(".menu").toggleClass("menu-wide", true);
      $(".menu-command-caption").toggle(true);
      $("#menu-filters").toggle(true);
    });
  }
  else if ((forceShowHide===undefined && hamburgerOpen) || forceShowHide===false) {
    hamburgerOpen = false;
    $(".menu").toggleClass("menu-wide", false);
    $(".menu-command-caption").toggle(false);
    $("#menu-filters").toggle(false);
    $(".menu").animate({width:48}, 100);
  }
}

function createMenu(menus, selected) {
  var $menu = $("#menu");
  var $menuCommands = $("#menu-commands");

  function _createHamburgerMenu(toggleFn) {
    var $menuHamburger = $("#menu-hamburger");
    var $hamburger = $('<div class="menu-command"><img src="/core/images/hamburger.svg"></img></div>').appendTo($menuHamburger);
    $hamburger.click(function(event) { _toggleHamburger(); });
    return $menuHamburger;
  }

  function create(menu) {
    if (menu.$command) {
      menu.$command.appendTo($menuCommands);
    }
    else {
      var $menu = $('<div class="menu-command"></div>').appendTo($menuCommands);
      $menu.attr("original-title", menu.label);
      var $img = $('<img></img>').attr('src', menu.icon).appendTo($menu);
      var $span = $('<div class="menu-command-caption"></div>').appendTo($menu); $span.text($menu.attr('original-title'));
      if (selected === menu.name) $menu.addClass('menu-command--selected');
      $menu.tipsy({ gravity:'w' });
      $menu.click(function() {
        window.location = menu.href;
      }); 
    }
  }

  menus = [].concat(menus);
  menus.push({ $command:_createHamburgerMenu(), index:-1 });
  menus.sort(function(a,b) { return a.index - b.index; });
  for (var i=0; i<menus.length; i++) {
    var menu = menus[i];
    create(menu);
  }
}


/**
 * Display a flash message
 */
var $flash, $flashInner;
function flashError(message, status) {
  if (status === 401) message = message + " (not authorized)";
  return flash(message, true);
}
function flash(message, error) {
  if (!$flash) {
    $flash = $('<div id="flash"></div>').appendTo('body');;
    $flashInner = $('<div class="flash_inner"></div>').appendTo($flash);
  }
  $flash.toggleClass("flash-error", !!error);
  var left = Math.floor((($(window).width()-$flash.width())/2)-20);
  var bottom = Math.floor($(window).height()+50);
  $flashInner.text(message);
  $flash.finish().css({ opacity:0, top:bottom, left:left }).animate({ opacity:0.8, top:8 }).delay(3000).animate({ opacity:0, top:-150 })
  $flash.click(function() {
    $flash.finish().animate({ opacity:0, top:-150 });
  });
}

/**
 * Displays a modal dialog
 */
function openDialog(options, open) {
  var width = $('body').width();
  var height = $('body').height();

  var $interceptor = $("<div class='interceptor'></div>");
  $("body").append($interceptor);

  var $dialog = $("<div class='dialog'></div>");
  if (options.css) $dialog.css(options.css);
  if (options.header !== false) {
    var $header = $("<div class='dialog-header'></div>").appendTo($dialog);
    var $title = $("<div class='dialog-title'></div>").appendTo($header);
    if (options.title && options.title.length > 0) $title.text(options.title); else $title.html("&nbsp;");
    if (options.close !== false) { 
      var $close = $("<div class='dialog-close'></div>").appendTo($header); 
      createCloseIcon().appendTo($close);
    }
  }
  var $body = $("<div class='dialog-body'></div>").appendTo($dialog);


  var close = function() {
    $dialog.remove();
    $interceptor.remove();
  }
  if ($close) $close.click(close);

  $('body').append($dialog);
  $dialog.css({
    top: (height - $dialog.height())/2,
    left: (width - $dialog.width())/2
  });
  $dialog[0].onwheel = function(e) {
    e.stopPropagation();
  };

  $(document).keydown(function(e) {
    switch(e.which) {
      case KEY_ESCAPE: { e.stopPropagation(); return close(); }
    }
  });

  if (open) open($body);

  return {
    $body: $body,
    close: close
  }
}

/** ================================================================================
  * Login / Logout
  * ================================================================================ */

/**
 * Display a loging dialog
 * @param initialMessage, if set is an optional error message to display right away in the login dialog
 * @param callback is an optional callback function to call after successful login. If not specified, the page will be reloaded
 */
function openLoginDialog(initialMessage, callback) {
  var configurationManager = new ConfigurationManager();
  var userContext = document.userContext;

  var modal = openDialog({ css: {height:520} }, function($body) {
    var html = '<div class="login-frame"></div>' +
                '  <div class="login-user-avatar">' +
                '   <div class="login-user-avatar-circle-mask" style="background-image: none;">' +
                '     <img class="login-user-avatar-circle" width="96" height="96"></img>' +
                '   </div>' +
                '  </div>' +
                '  <div class="login-user-name"></div>' +
                '  <div class="login-user-email"></div>' +
                '  <input id="login" name="login" class="login-input-login" spellcheck="false" placeholder="Enter your login">' +
                '  <input id="password" type="password" spellcheck="false" name="password" class="login-input-password">' +
                '  <div class="login-error-message"></div>' +
                '  <button class="login-login">Login</button>'
    var $login = $(html).appendTo($body);
    if (initialMessage) $('.login-error-message').text(initialMessage);
    $body.keydown(function(e) {
      switch(e.which) {
        case KEY_RETURN: { e.stopPropagation(); $(".login-login").click(); }
        default: e.stopPropagation();
      }
    });
    var avatar;
    if (userContext && userContext.user) {
      avatar = userContext.user.avatar;
      if (!avatar || avatar.length===0) avatar = "/images/anonymous.jpg";
      $(".login-user-avatar-circle").attr("src", avatar);
      $(".login-user-name").text(userContext.user.name);
      $(".login-user-email").text(userContext.user.email);
    }
    $(".login-input-login").blur(function() {
      var login = $(".login-input-login").val();
      var user = configurationManager.loadUser(login);
      if (user) {
        if (user.avatar && user.avatar.length > 0)  $(".login-user-avatar-circle").attr("src", user.avatar);
        if (user.name && user.name.length > 0)      $(".login-user-name").text(user.name);
        if (user.email && user.email.length > 0)    $(".login-user-email").text(user.email);
      }
    });
    $(".login-input-login").focus();
    var $login = $(".login-login");
    $login.click(function() {
      var login = $(".login-input-login").val();
      var password = $(".login-input-password").val();

      return ajax({
        type: 'POST',
        url: '/login',
        data: { login:login, password:password },
        dataType: 'json',
        success: function(userContext) {
          document.userContext = userContext;
          configurationManager.saveUserContext(userContext);
          configurationManager.saveUser(userContext.user.login, userContext.user);
          modal.close();
          if (callback) callback.call(this);
          else location.reload();
        },
        error: function(jqxhr, textStatus, error) {
          if (jqxhr && jqxhr.status === 401) {
            try {
              var res = JSON.parse(jqxhr.responseText);
              var message = res.message;
              if (message && message.length > 0) {
                $('.login-error-message').text(message);
              }
            }
            finally {}
          }
        }
      });
    });
  });

}

function refreshLoginInfos() {
  var configurationManager = new ConfigurationManager();

  $(".login").empty().remove();
  $(".login-frame").empty().remove();
  $(".menu-user-avatar-circle-mask").empty().remove();

  var userContext = document.userContext;
  if (!userContext) {
    userContext = {
      showUser: true,
      user: {
        avatar: "/images/anonymous.jpg",
        name: "Nobody"
      }
    }
  }
  if (!userContext.showUser) return;

  var $userMenu = $('' +
                    '   <div class="menu-user-avatar-circle-mask" style="background-image: none;">' +
                    '     <img class="menu-user-avatar-circle" width="32" height="32"></img>' +
                    '   </div>' +
                    '   <div class="menu-user-name"></div>');
  $userMenu.appendTo($('body'));
  $(".menu-user-avatar-circle").attr("src", userContext.user.avatar);
  $(".menu-user-name").text(userContext.user.name);
  $(".menu-user-avatar-circle").click(function() {
    var popup = openDialog({ css: { height:220, width:350 }, close:false, header:false }, function($body) {
      var html = '<div class="prefs-user">' +

                 '  <div class="prefs-user-avatar">' +
                 '   <div class="prefs-user-avatar-circle-mask" style="background-image: none;">' +
                 '     <img class="prefs-user-avatar-circle" width="96" height="96"></img>' +
                 '   </div>' +
                 '  </div>' +
                 '  <div class="prefs-user-user">' +
                 '    <div class="prefs-user-name"></div>' +
                 '    <div class="prefs-user-email"></div>' +
                 '  </div>' +

                 '</div>' +

                 '<div class="popup-action">' +
                 '  <button class="popup-action-login">Login</button>' +
                 '  <button class="popup-action-logout">Logout</button>' +
                 '</div>';

      var $popup = $(html).appendTo($body);

    var avatar = userContext.user.avatar;
    if (!avatar || avatar.length===0) avatar = "/images/anonymous.jpg";
    $(".prefs-user-avatar-circle").attr("src", avatar);
    $(".prefs-user-name").text(userContext.user.name);
    $(".prefs-user-email").text(userContext.user.email);

      $body.keydown(function(e) {
        switch(e.which) {
          case KEY_ESCAPE: { e.stopPropagation(); popup.close(); }
          default: e.stopPropagation();
        }
      });

      $(".popup-action-login").click(function() {
        popup.close();
        openLoginDialog();
      });
      $(".popup-action-logout").click(function() {
        popup.close();
        return ajax({
          type: 'POST',
          url: '/logout',
          data: { },
          dataType: 'json',
          success: function(userContext) {
            document.userContext = userContext;
            configurationManager.saveUserContext(userContext);
            //refreshLoginInfos();
            location.reload();
          },
          error: function(jqxhr, textStatus, error) {
            flashError("Failed to logout");
          }
        });
      });
    });
  });

}

/** ================================================================================
  * Ajax
  * ================================================================================ */

/**
 * Perform an Ajax call with error managment.
 * @data is a patload for the jQuery ajax function (http://api.jquery.com/jQuery.ajax)
 * We're using success, error, and complete attributes to manage return from the query
 */
function ajax(data) {
  var successFn = data.success;
  var errorFn = data.error;
  var completeFn = data.complete;
  data.complete = function() {
    if (completeFn)
      return completeFn.apply(this, arguments);
  }
  data.success = function() {
    if (successFn)
      return successFn.apply(this, arguments);
  }
  data.error = function(jqxhr, textStatus, error) {
    // HTTP error
    if (jqxhr.readyState === 4) {
      if (jqxhr.status === 401) {
        if (jqxhr.responseJSON && jqxhr.responseJSON.code === 13) {
          // Token expired
          return openLoginDialog('Session expired, please login again', function() {
            // Retry operation
            return ajax(data);
          });
        }
      }
      if (errorFn)
        return errorFn.call(this, jqxhr, textStatus, error);
    }
    // Network error (i.e. connection refused, access denied due to CORS, etc.)
    else if (jqxhr.readyState === 0) {
      flashError("Server unreachable");
      return
    }
    // Other errors (should not happen)
    else {
      flashError("Unknown error");
      return        
    }
  }
  return $.ajax(data);
}


/** ================================================================================
  * Global init
  * ================================================================================ */

$(function() {
  var env = $('#env').text();
  if (env === 'dev') $('#env').toggleClass('env-dev');
  if (env === 'test') $('#env').toggleClass('env-test');

  refreshLoginInfos();

}); 
