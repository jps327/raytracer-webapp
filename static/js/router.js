/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 */

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

var Router = (function() {
  var loadedPage = false;
  var RayTracerRouter = Backbone.Router.extend({
    HOME: 'home',
    ABOUT: 'about',
    CONTACT: 'contact',
    SCENE: 'scene',

    routes: {
      "" : "home",
      "home" : "home",
      "about" : "about",
      "contact" : "contact",
      "scene" : "scene",
    },

    goToRoot: function() {
      this.navigate("", {trigger: true});
    },

    switchPage: function(view) {
      // TODO: find a way to not call init each time
      $(function() {
        $(".nav li").removeClass('active');
        if (view !== this.SCENE) {
          $(".nav-" + view).addClass('active');
        }
        if (!loadedPage) {
          Main.init();
          loadedPage = true;
        }
        Main.switchToView(view);
      });
    },

    home: function() {
      this.switchPage(this.HOME);
    },

    about : function() {
      this.switchPage(this.ABOUT);
    },

    contact: function() {
      this.switchPage(this.CONTACT);
    },

    scene: function() {
      this.switchPage(this.SCENE);
      $(function() {
        Main.getCurrentView().render();
      });
    },

  });

  var router = new RayTracerRouter();
  Backbone.history.start({root: "/"});
  return router;
})();
