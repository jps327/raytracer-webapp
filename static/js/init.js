if (!Function.prototype.bind) {
  // if the browser does not support function.bind(), then create our own
  // because it's awesome and helpful and allows currying
  Function.prototype.bind = function(oThis) {
    if (typeof this !== "function") {
      throw new TypeError("Function.prototype.bind - what is trying to be bound"
         + " is not callable");
    }
    var aArgs = Array.prototype.slice.call(arguments, 1), 
      fToBind = this, 
      fNOP = function () {},
      fBound = function () {
        return fToBind.apply(
          this instanceof fNOP &&
          oThis ? this : oThis,
          aArgs.concat(Array.prototype.slice.call(arguments))
        );
      };
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
    return fBound;
  };
}

//Ensures there will be no 'console is undefined' errors
window.console = window.console || (function(){
    var c = {}; c.log = c.warn = c.debug = c.info = c.error = c.time = c.dir = c.profile = c.clear = c.exception = c.trace = c.assert = function(){};
    return c;
})();

var Util = (function() {
  // clones any object
  var clone = function(obj) {
    return $.extend(true, {}, obj);
  };

  // turns an object into an array of its elements
  var objectToArray = function(obj) {
    var arr = [];
    for (var key in obj) {
      arr.push(obj[key]);
    }
    return arr;
  };

  // turns an object into an array of its keys
  var objectToKeyArray = function(obj) {
    var arr = [];
    for (var key in obj) {
      arr.push(key);
    }
    return arr;
  };

  return {
    clone: clone,
    objectToArray: objectToArray,
    objectToKeyArra: objectToKeyArray,
  };
})();

var Init = (function() {
  var storedAcid = "";
  var storedFbId = "";
  var storedFbUserName = "";

  var fbLoggedIn = false;
  var fbInitComplete = false;

  var getAcid = function() {
    return storedAcid;
  };

  var setAcid = function(acid) {
    storedAcid = acid;
  };

  var getFbId = function() {
    return storedFbId;
  };

  var setFbId = function(id) {
    storedFbId = id;
  };

  var getFbUserName = function() {
    return storedFbUserName;
  };

  var setFbUserName = function(name) {
    storedFbUserName = name;
  };

  // returns if FB has been initialized - i.e. user has logged in, and
  // an acid has been returned through getAcidFb
  var isInitialized = function() {
    return fbInitComplete;
  };

  var getCreateSceneButton = function() {
    return $('.create-scene-button');
  };

  var login = function() {
    FB.login(function(response) {
      if (response.authResponse) {
        // successful log in
        console.log("Successful login!");
        getCreateSceneButton().off('click', login);
      }
    }, {scope: 'email'});
  };

  var handleAuthResponseChange = function(response) {
    if (response.authResponse) {
      console.log("Logged in!");
      if (!fbLoggedIn) {
        console.log("FB logged in first time");
        var authResponse = response.authResponse;
        fbLoggedIn = true;
        $.ajax({
          type: 'POST',
          url: '/api/getAcidFb',
          data: {
            accessToken: authResponse.accessToken,
            userID: authResponse.userID
          },
          dataType: 'json',
          success: function(res) {
            setAcid(res.acid);
            setFbId(authResponse.userID);
            console.log("Received Acid: " + res.acid);
            fbInitComplete = true;

            // get fb user info
            FB.api('/me', function(user) {
              setFbUserName(user.name);
            });
          },
          error: function(res) {
            // TODO: handle error
          },
          timeout: 5000
        });

      }
    } else {
      console.log("Not authenticated");
      getCreateSceneButton().on('click', login);
    }
  };

  var initFB = function() {
    var facebookReady = function() {
      FB.init({
        appId : '196323000516887', // App ID
        status : true, // check login status
        cookie : true, // enable cookies to allow the server to access the session
        xfbml : true  // parse XFBML
      });

      FB.Event.subscribe(
        'auth.authResponseChange',
        handleAuthResponseChange
      );
      FB.getLoginStatus(handleAuthResponseChange);
    };

    if (window.FB) {
      facebookReady();
    } else {
      window.fbAsyncInit = facebookReady;
    }
  };

  initFB();

  return {
    initFB: initFB,
    getAcid: getAcid,
    getFbId: getFbId,
    getFbUserName: getFbUserName,
    isInitialized: isInitialized,
  };

})();

// Facebook
(function(d){
  var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
  if (d.getElementById(id)) {return;}
  js = d.createElement('script'); js.id = id; js.async = true;
  js.src = "//connect.facebook.net/en_US/all.js";
  ref.parentNode.insertBefore(js, ref);
}(document));
