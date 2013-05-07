/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 */

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
      "scene/:id" : "scene",
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

    scene: function(sceneID) {
      this.switchPage(this.SCENE);
      $(function() {
        Main.getCurrentView().loadData(sceneID);
      });
    },

  });

  var router = new RayTracerRouter();
  Backbone.history.start({root: "/"});
  return router;
})();
