/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 */

Main = (function() {
  var mainViews = {};
  var galleryItemViews = [];

  var currentView = Router.HOME;

  var getCurrentViewID = function() {
    return currentView;
  };

  var getCurrentView = function() {
    return mainViews[currentView];
  };

  var getView = function(id) {
    return mainViews[id];
  };

  var switchToView = function(id) {
    mainViews[id].switchToThisView();
  };

  var init = function() {
    // View for the Materials tab in the Create Scene modal dialog
    var MaterialCreatorView = Backbone.View.extend({
      el: $('.materials-tab'),
      events: {
        'changed .material-select' : 'onMaterialSelect',
      },
      materials: {
        lambertian : {
          label: 'Lambertian',
          properties: {
            diffuseColor: {label: 'Diffuse Color', type: 'color'}
          }
        },
        phong: {
          label: 'Phong',
          properties: {
            diffuseColor: {label: 'Diffuse Color', type: 'color'},
            specularColor: {label: 'Specular Color', type: 'color'},
            exponent: {label: 'Exponent', type: 'number'},
          }
        }
      },
      initialize: function() { 
        this.render();                    
      },
      render: function() {
        var selectBoxItem = _.template($('#t-select-box-item').html());
        var dropdownMenu = this.$('.materials-dropdown-box');
        dropdownMenu.empty();
        for (var materialName in this.materials) {
          dropdownMenu.append(selectBoxItem({
            value: materialName,
            label: this.materials[materialName].label
          }));
        }
        return this;
      },
      onMaterialSelect: function(event) {
        console.log('omggg');
        alert('wat');
      },
    });

    var BaseView = Backbone.View.extend({
      initialize: function() {
        if (getCurrentViewID() !== this.id) {
          this.$el.hide();
        }
      },

      switchToThisView: function() {
        // only switch if we are going to a new view
        if (getCurrentViewID() !== this.id) {
          mainViews[currentView].$el.hide();
          this.$el.show();
          currentView = this.id;
        }
        return this;
      }
    });

    var HomeView = BaseView.extend({
      el: $('.home'),
      id: Router.HOME,
      initialize: function() {
        HomeView.__super__.initialize.apply(this, arguments);
        materialsTab = new MaterialCreatorView;
      },
    });

    var AboutView = BaseView.extend({
      el: $('.about'),
      id: Router.ABOUT,
    });

    var ContactView = BaseView.extend({
      el: $('.contact'),
      id: Router.CONTACT,
    });

    var SceneView = BaseView.extend({
      el: $('.scene'),
      template: _.template($('#t-scene').html()),
      id: Router.SCENE,

      displayFinishedImage: function(imageFileName) {
        var imgTemplate = _.template($('#t-finished-image').html());
        var imgContainer = this.$('.finished-image-container');
        imgContainer.empty();
        imgContainer.html(imgTemplate({
          imageName: imageFileName
        }));
        return this;
      },
      render: function() {
        this.$el.html(this.template({
          sceneName: "Simple Box"
        })); 

        // TODO: this should happen only when the connect button is clicked
        Client.connectToScene();

        return this;
      },
    });

    var GalleryItemView = Backbone.View.extend({
      tagName: 'li',
      template: _.template($('#t-gallery-thumbnail').html()),
      events: {
        "click .connect" : "onConnectClick"
      },
      connected: false,

      initialize: function() {
        this.render();
      },
      render: function() {
        this.$el.addClass('span4');
        this.$el.html(this.template({
          imageName: "Image Name",
          artistName: "Artist Name",
          numUsersConnected: 10,
        }));
        $('.gallery-thumbnails').append(this.$el);
        return this;
      },

      onConnectClick: function(event) {
        console.log(this.connected);
        this.connected = !this.connected;
        var btn = $(event.target);
        if (this.connected) {
          btn.text('Connected');
          btn.addClass('btn-success');
          btn.removeClass('btn-primary');
        } else {
          btn.text('Connect');
          btn.addClass('btn-primary');
          btn.removeClass('btn-success');
        }
      },
    });

    mainViews[Router.HOME] = new HomeView;
    mainViews[Router.ABOUT] = new AboutView;
    mainViews[Router.CONTACT] = new ContactView;
    mainViews[Router.SCENE] = new SceneView;

    // TODO: load in gallery views from DB
    for (var i = 0; i < 7; i++) {
      galleryItemViews.push(new GalleryItemView);
    }

  };

  return {
    getView: getView,
    getCurrentView: getCurrentView,
    switchToView: switchToView,
    init: init,
  };

})();
