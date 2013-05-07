/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 */

Main = (function() {
  var mainViews = {};
  var currentView = Router.HOME;
  var selectedScene = null; // the scene we are viewing

  var Scene = Backbone.Model.extend({
    idAttribute: '_id',
    initialize: function() {
      this.set({ filename: this.id + ".png"});
    },
  });

  var GalleryItem = Backbone.Model.extend({
    idAttribute: '_id',
    initialize: function() {
      var thumbnailFilename = this.get('finishedRendering') ?
        "raytraced_images/" + this.id + ".png" :
        "thumbnail_images/" + this.id + ".png";
      this.set({ thumbnail: thumbnailFilename});
    },
  });

  var GalleryItemCollection = Backbone.Collection.extend({ model: GalleryItem });
  var gallery = new GalleryItemCollection;

  var getSelectedScene = function() {
    return selectedScene;
  };

  var getGalleryItems = function() {
    return gallery;
  };

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
    var TreeDataSource = function(dataList) {
      this._data = dataList;
    };

    TreeDataSource.prototype = {
      data: function(options, callback) {
        var data = $.extend(true, [], this._data);
        callback({ data: data });
      },
    };

    // View for the Objects tab in the Create Scene modal dialog
    var ObjectCreatorView = Backbone.View.extend({
      el: $('.objects-tab'),
      events: {
        'changed .object-select' : 'onObjectSelect',
        'click .add-object' : 'onAddClick',
      },

      objects: {
        group: {
          label: 'Group',
          properties: { },
        },
        sphere: {
          label: 'Sphere',
          properties: {
            center: {label: 'Center', type: 'vector'},
            radius: {label: 'Radius', type: 'number'},
          }
        },
        box: {
          label: 'Box',
          properties: {
            minPt: {label: 'Min Point', type: 'vector'},
            maxPt: {label: 'Max Point', type: 'vector'},
          }
        },
      },

      addedObjects: [],
      initialize: function() {
        this.render();
      },

      getAddedObjects: function() {
        return this.addedObjects;
      },

      getMaterialsTab: function() {
        return mainViews[Router.HOME].getCreateSceneDialog().getMaterialsTab();
      },

      render: function() {
        var selectBoxItem = _.template($('#t-select-box-item').html());
        var dropdownMenu = this.$('.objects-dropdown-box');
        dropdownMenu.empty();
        for (var objectName in this.objects) {
          dropdownMenu.append(selectBoxItem({
            value: objectName,
            label: this.objects[objectName].label
          }));
        }
        this.renderTree();

        return this;
      },

      renderTree: function() {
        var addedObjectsEl = this.$('.added-objects');
        var treeTemplate = _.template($('#t-item-folder-tree').html());
        addedObjectsEl.empty();
        addedObjectsEl.html(treeTemplate({ className: 'added-objects-tree' }));
        this.$('.added-objects-tree').tree({
          dataSource: new TreeDataSource(this.addedObjects),
        });
      },

      onAddClick: function(event) {
        this.addedObjects.push({ name: 'Test', type: 'item', additional: 'param' });
        this.renderTree();
      },

      onObjectSelect: function(event, data) {
        var properties = this.objects[data.value].properties;
        properties.scale = {label: 'Scale', type: 'number'};
        properties.rotate = {label: 'Rotate', type: 'vector'};
        properties.translate = {label: 'Translate', type: 'vector'};
        if (data.value !== 'group') {
          properties.objectMaterial = {label: 'Material', type: 'material-select'};
        }

        // render the form
        var template = _.template($('#t-object-properties-form').html());
        var objectPropertiesForm = this.$('.object-properties-form');
        objectPropertiesForm.empty();
        objectPropertiesForm.html(template({
          properties: properties,
        }));

        // if this is not a Group, then add the select-materials dropdown items
        if (data.value !== 'group') {
          var materials = this.getMaterialsTab().getAddedMaterials();
          var selectBoxItem = _.template($('#t-select-box-item').html());
          var dropdownMenu = this.$('.object-materials-dropdown-box');
          dropdownMenu.empty();
          for (var i = 0; i < materials.length; i++) {
            var material = materials[i];
            dropdownMenu.append(selectBoxItem({
              value: material.name,
              label: material.name,
            }));
          }
          this.$('.object-material-select').select();
        }
      },
    });

    // View for the Materials tab in the Create Scene modal dialog
    var MaterialCreatorView = Backbone.View.extend({
      el: $('.materials-tab'),
      events: {
        'changed .material-select' : 'onMaterialSelect',
        'click .add-material' : 'onAddClick',
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

      addedMaterials: [],

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
        this.renderTree();

        return this;
      },

      getAddedMaterials: function() {
        return this.addedMaterials;
      },

      renderTree: function() {
        var addedMaterialsEl = this.$('.added-materials');
        var treeTemplate = _.template($('#t-item-folder-tree').html());

        addedMaterialsEl.empty();
        addedMaterialsEl.html(treeTemplate({ className: 'added-materials-tree' }));
        this.$('.added-materials-tree').tree({
          dataSource: new TreeDataSource(this.addedMaterials),
        });
      },

      onAddClick: function(event) {
        this.addedMaterials.push({ name: 'Test', type: 'item', additional: 'param' });
        this.renderTree();
      },

      onMaterialSelect: function(event, data) {
        var properties = this.materials[data.value].properties;
        var template = _.template($('#t-material-properties-form').html());
        var materialPropertiesForm = this.$('.material-properties-form');
        materialPropertiesForm.empty();
        materialPropertiesForm.html(template({
          properties: properties
        }));
        var colorpickers = $('.colorpicker');
        if (colorpickers.length > 0) {
          colorpickers.colorpicker();
        }
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

    var CreateSceneDialogView = Backbone.View.extend({
      el: $('.createSceneModal'),
      events: {
        'click .btn-done' : 'onDoneClick',
      },

      initialize: function() {
        this.materialsTab = new MaterialCreatorView;
        this.objectsTab = new ObjectCreatorView;
      },

      getMaterialsTab: function() {
        return this.materialTab;
      },

      getObjectsTab: function() {
        return this.objectsTab;
      },

      onDoneClick: function() {
        // Create the Scene as a JSON object
        var scene = this.getSceneAsJSON();
        console.log("Sending API request");
        $.ajax({
          type: 'POST',
          url: '/api/createScene',
          data: {
            scene: scene
          },
          success: (function(res) {
            console.log(scene);
            console.log('Success!');
            this.$el.modal('hide');
          }).bind(this),
          error: function(res) {
            console.log('Error creating scene!');
          },
        });
      },

      getSceneAsJSON: function() {
        return {
          title: 'Test Scene',
          author: 'Author',
          dimensions: this.gatherDimensions(),
          camera: this.gatherCamera(),
          lights: this.gatherLights(),
          materials: this.gatherMaterials(),
          objects: this.gatherObjects(),
        };
      },

      $C: function(r, g, b) {
        return { r: r, g: g, b: b };
      },

      $V: function(x, y, z) {
        return { x: x, y: y, z: z };
      },

      gatherDimensions: function() {
        return {
          width: 400,
          height: 300,
        };
      },

      gatherCamera: function() {
        return {
          eye: this.$V(0, 0, 1),
          viewDirection: this.$V(0, 0, -1),
          up: this.$V(0, 1, 0),
          projectionDistance: 1
        };
      },

      gatherLights: function() {
        // a light is a (position, intensity) tuple
        // returns a list of lights
        return [
          { position: this.$V(0, 0, 0), intensity: this.$C(1, 1, 1)}
        ];
      },

      gatherMaterials: function() {
        // returns a map of materialName -> materialProperties
        return {
          plastic: {
            type: 'phong',
            diffuseColor: this.$C(0, 0, 1),
            specularColor: this.$C(0, 1, 1),
            exponent: 100,
          },
        };
//        return this.getMaterialsTab().getAddedMaterials();
      },

      gatherObjects: function() {
        /*
        return [
          {
            type: 'group',
            scale: this.$V(0.5, 0.5, 0.5),
            rotate: this.$V(-5, 5, 10),
            translate: this.$V(0.3, 0.3, -5),
            objects: [
              {
                type: 'box',
                minPt: this.$V(-1, -0.5, -3),
                maxPt: this.$V(1, 0.5, 3),
                shader: 'plastic',
                scale: this.$V(1, 1, 1),
                rotate: this.$V(0, 0, 0),
                translate: this.$V(0, 0, 0)
              }
            ]
          },
        ];
        */

        return [
          {
            type: 'box',
            minPt: this.$V(-1, -0.5, -3),
            maxPt: this.$V(1, 0.5, 3),
            shader: 'plastic',
            scale: this.$V(0.5, 0.5, 0.5),
            rotate: this.$V(-5, 5, 10),
            translate: this.$V(0.3, 0.3, -5),
          }
        ];

//        return this.getObjectsTab().getAddedObjects();
      },
    });

    var HomeView = BaseView.extend({
      el: $('.home'),
      id: Router.HOME,
      initialize: function() {
        HomeView.__super__.initialize.apply(this, arguments);
        this.galleryView = new GalleryView;
        this.createSceneDialog = new CreateSceneDialogView;
      },

      getGalleryView: function() {
        return this.galleryView;
      },

      getCreateSceneDialog: function() {
        return this.createSceneDialog;
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

      loadData: function(sceneID) {
        $.ajax({
          type: 'POST',
          url: '/api/getSceneInfo',
          data: {
            sceneID: sceneID
          },
          success: (function(res) {
            selectedScene = new Scene(res.scene);
            this.render();
          }).bind(this),
          error: function(res) {
            // TODO: resent request on error, or depends on the error
          },
          timeout: 5000
        });
      },

      render: function(sceneID) {
        this.$el.html(this.template({
          scene: selectedScene.toJSON(),
        })); 
        return this;
      },
    });

    var GalleryItemView = Backbone.View.extend({
      tagName: 'li',
      template: _.template($('#t-gallery-thumbnail').html()),
      events: {
        "click .btn-connect" : "onConnectClick",
      },
      connected: false,

      initialize: function(options) {
        this.model.on('change:thumbnail', this.onChangeThumbnail, this);
        this.render();
      },

      onChangeThumbnail: function() {
        this.render();
      },

      render: function() {
        this.$el.addClass('span4');
        this.$el.html(this.template({
          sceneID: this.model.id,
          sceneThumbnail: this.model.get('thumbnail'),
          sceneName: this.model.get('title'),
          artistName: this.model.get('author'),
          numUsersConnected: this.model.get('numUsersConnected'),
        }));
        return this;
      },

      onConnectClick: function(event) {
        this.connected = !this.connected;
        var btn = $(event.target);
        var url = '';
        if (this.connected) {
          btn.text('Connected');
          btn.addClass('btn-success');
          btn.removeClass('btn-primary');

          // now connect to the scene
          Client.connectToScene(this.model.id);
        } else {
          btn.text('Connect');
          btn.addClass('btn-primary');
          btn.removeClass('btn-success');
          // TODO: allow disconnecting from scene
        }
      },
    });

    var GalleryView = Backbone.View.extend({
      el: $('.gallery'),
      galleryItemViews: [],

      initialize: function() {
        gallery.bind('reset', this.resetGalleryItems, this);
        this.render();
      },

      render: function() {
        this.loadData();
        return this;
      },

      resetGalleryItems: function(galleryItems) {
        var galleryThumbnails = this.$('.gallery-thumbnails');
        galleryThumbnails.empty();

        var container = document.createDocumentFragment();
        galleryItems.each(function(galleryItem) {
          var view = new GalleryItemView({ model: galleryItem });
          container.appendChild(view.render().el);
        });
        galleryThumbnails.append(container);
      },

      loadData: function() {
        $.ajax({
          type: 'POST',
          url: 'api/getScenes',
          data: {},
          success: (function(res) {
            console.log("getScenes Success");
            gallery.reset(res.scenes);
          }).bind(this),
        });
      },
    });

    mainViews[Router.HOME] = new HomeView;
    mainViews[Router.ABOUT] = new AboutView;
    mainViews[Router.CONTACT] = new ContactView;
    mainViews[Router.SCENE] = new SceneView;
  };

  return {
    getGalleryItems: getGalleryItems,
    getSelectedScene: getSelectedScene,
    getView: getView,
    getCurrentView: getCurrentView,
    switchToView: switchToView,
    init: init,
  };

})();
