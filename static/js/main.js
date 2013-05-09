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
      this.set({ imageSrc : "../raytraced_images/" + this.id + ".png"});
    },
  });

  var GalleryItem = Backbone.Model.extend({
    idAttribute: '_id',
    initialize: function() {
      if (this.get('finishedRendering')) {
        this.set({ thumbnailURL: "../raytraced_images/" + this.id + ".png" });
      }
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

    // Base View for the ObjectCreator and MaterialCreator Views
    var BaseCreatorView = Backbone.View.extend({
      selectedItem: "", // what item type we've currently selected

      initialize: function(options) {
        this.creatorType = options.creatorType;
      },

      clearAddedItems: function() {
        this.addedItems = [];
      },

      addItem: function(item) {
        this.addedItems.push(item);
      },

      getAddedItems: function() {
        return this.addedItems;
      },

      isObjectCreator: function() {
        return this.creatorType === 'object';
      },

      isMaterialCreator: function() {
        return this.creatorType === 'material';
      },

      parseRGBString: function(str) {
        var rgb = str.substring(4, str.length-1).split(',');
        rgb = _.map(rgb, function(n) { return parseFloat(n) / 255; });
        return {r: rgb[0], g: rgb[1], b: rgb[2]};
      },

      gatherVectorInput: function(id) {
        return {
          x: this.$("#" + id + "-x").val(),
          y: this.$("#" + id + "-y").val(),
          z: this.$("#" + id + "-z").val(),
        };
      },

      render: function() {
        if (this.creatorType !== 'light') {
          // Lights don't have multiple item types, so we don't need to render
          // the selcectors. We have to do this for objects and materials.
          var selectBoxItem = _.template($('#t-select-box-item').html());
          var dropdownMenu = this.$("."+this.creatorType+"s-dropdown-box");
          dropdownMenu.empty();
          for (var itemTypeName in this.itemTypes) {
            dropdownMenu.append(selectBoxItem({
              value: itemTypeName,
              label: this.itemTypes[itemTypeName].label
            }));
          }

          // Start off by selecting the first item
          var selectBox = this.$("."+this.creatorType+"-select");
          selectBox.select('selectByIndex', 0);
          if (this.isObjectCreator()) {
            this.onObjectSelect(null, selectBox.select('selectedItem'));
          } else {
            this.onMaterialSelect(null, selectBox.select('selectedItem'));
          }
        } else if (this.creatorType === 'light') {
          this.$('.light-colorpicker').colorpicker();
        }

        this.renderTree();
        return this;
      },

      renderTree: function() {
        var addedItemsEl = this.$(".added-"+this.creatorType+"s");
        var treeClass = "added-"+this.creatorType+"s-tree";
        var treeTemplate = _.template($('#t-item-folder-tree').html());
        addedItemsEl.empty();
        addedItemsEl.html(treeTemplate({ className: treeClass }));
        this.$("." + treeClass).tree({
          dataSource: new TreeDataSource(this.addedItems),
        });

        return this;
      },
    });

    // View for the Lights tab in the Create Scene modal dialog
    // This is more straightforward than ObjectCreator and MaterialCreatorView
    // because lights don't have multiple types, so we don't need to keep track
    // of the possible types and their properties
    var LightCreatorView = BaseCreatorView.extend({
      el: $('.lights-tab'),
      addedItems: [],

      events: {
        'click .add-light' : 'onAddClick',
      },

      initialize: function() {
        LightCreatorView.__super__.initialize.apply(this, arguments);
        this.render();
      },

      onAddClick: function(event) {
        var light = {};
        light.name = this.$('#inputLightName').val();
        light.position = this.gatherVectorInput('inputLightPos');
        light.color = this.parseRGBString(this.$('#inputLightColor').val());
        light.intensity = parseFloat(this.$('#inputLightIntensity').val());
        this.addItem({
          name: light.name,
          type: 'item',
          light: light
        });
        this.renderTree();
      },
    });

    // View for the Objects tab in the Create Scene modal dialog
    var ObjectCreatorView = BaseCreatorView.extend({
      el: $('.objects-tab'),
      addedItems: [],

      events: {
        'changed .object-select' : 'onObjectSelect',
        'click .add-object' : 'onAddClick',
      },

      itemTypes: {
        group: {
          label: 'Group',
          properties: { },
        },
        sphere: {
          label: 'Sphere',
          properties: {
            center: {label: 'Center', type: 'vector', val: {x:0, y:0, z:0}},
            radius: {label: 'Radius', type: 'number', val: 1},
          }
        },
        box: {
          label: 'Box',
          properties: {
            minPt: {label: 'Min Point', type: 'vector', val: {x:-0.5,y:-0.5,z:-0.5}},
            maxPt: {label: 'Max Point', type: 'vector', val: {x:0.5,y:0.5,z:0.5}},
          }
        },
      },

      initialize: function() {
        ObjectCreatorView.__super__.initialize.apply(this, arguments);
        this.render();
      },

      getMaterialsTab: function() {
        return mainViews[Router.HOME].getCreateSceneDialog().getMaterialsTab();
      },

      onAddClick: function(event) {
        var object = {};
        object.name = this.$('#inputObjectName').val();
        object.type = this.selectedItem;

        // gather properties
        var objectProperties = this.itemTypes[this.selectedItem].properties;
        for (var propertyName in objectProperties) {
          var property = objectProperties[propertyName];
          if (property.type === 'vector') {
            object[propertyName] = this.gatherVectorInput(propertyName);
          } else if (property.type === 'material-select') {
            object[propertyName] = this.$("#" + propertyName)
              .select('selectedItem').value;
          } else {
            object[propertyName] = this.$("#" + propertyName).val();
          }
        }

        // gather transformations
        var scaleVal = this.$('#scale').val()
        object.scale = {x: scaleVal, y: scaleVal, z: scaleVal};
        object.rotate = this.gatherVectorInput('rotate');
        object.translate = this.gatherVectorInput('translate');

        this.addItem({
          name: object.name,
          type: 'item',
          object: object
        });
        this.renderTree();
      },

      onObjectSelect: function(event, data) {
        this.selectedItem = data.value;
        var properties = this.itemTypes[data.value].properties;
        properties.scale = {label: 'Scale', type: 'number', val: 1};
        properties.rotate = {label: 'Rotate', type: 'vector', val: {x:0, y:0, z:0}};
        properties.translate = {label:'Translate', type:'vector', val:{x:0,y:0,z:0}};
        if (data.value !== 'group') {
          properties.shader = {label: 'Material', type: 'material-select'};
        }

        // render the form
        var template = _.template($('#t-object-properties-form').html());
        var objectPropertiesForm = this.$('.object-properties-form');
        objectPropertiesForm.empty();
        objectPropertiesForm.html(template({
          properties: properties,
        }));

        // if this is not a Group, then add the select-materials dropdown items
        if (this.selectedItem !== 'group') {
          var materials = this.getMaterialsTab().getAddedItems();
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
    var MaterialCreatorView = BaseCreatorView.extend({
      el: $('.materials-tab'),
      addedItems: [],

      events: {
        'changed .material-select' : 'onMaterialSelect',
        'click .add-material' : 'onAddClick',
      },

      itemTypes: {
        lambertian : {
          label: 'Lambertian',
          properties: {
            diffuseColor: {label: 'Diffuse Color', type: 'color',
                            val: {r: 192, g: 192, b: 192}}
          }
        },
        phong: {
          label: 'Phong',
          properties: {
            diffuseColor: {label: 'Diffuse Color', type: 'color',
                            val: {r: 0, g: 0, b: 255}},
            specularColor: {label: 'Specular Color', type: 'color',
                            val: {r: 0, g: 255, b: 255}},
            exponent: {label: 'Exponent', type: 'number', val: 100},
          }
        }
      },

      initialize: function() { 
        MaterialCreatorView.__super__.initialize.apply(this, arguments);
        this.render();
      },

      onAddClick: function(event) {
        var material = {};
        material.name = this.$('#inputMatName').val();
        material.type = this.selectedItem;

        var materialProperties = this.itemTypes[this.selectedItem].properties;
        for (var propertyName in materialProperties) {
          var property = materialProperties[propertyName];
          if (property.type === 'color') {
            material[propertyName] = this.parseRGBString(
                this.$("#" + propertyName).val());
          } else {
            material[propertyName] = this.$("#" + propertyName).val();
          }
        }

        this.addItem({
          name: material.name,
          type: 'item',
          material: material
        });
        this.renderTree();
      },

      onMaterialSelect: function(event, data) {
        this.selectedItem = data.value;
        var properties = this.itemTypes[this.selectedItem].properties;
        var template = _.template($('#t-material-properties-form').html());
        var materialPropertiesForm = this.$('.material-properties-form');
        materialPropertiesForm.empty();
        materialPropertiesForm.html(template({
          properties: properties
        }));
        var colorpickers = $('.material-colorpicker');
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

    var ThumbnailTabView = Backbone.View.extend({
      el: $('.thumbnail-tab'),
      events: {
        'keydown #inputThumbnailURL' : 'onKeyDown',
      },

      initialize: function() {
        this.keyTimer = null;
      },

      onKeyDown: function() {
        clearTimeout(this.keyTimer);
        this.keyTimer = setTimeout(this.loadImage.bind(this), 1000);
      },

      loadImage: function() {
        var url = this.$('#inputThumbnailURL').val();
        thumbnailImg = this.$('.thumbnail-img');
        thumbnailImg.show();
        thumbnailImg.attr('src', url);
      },
    });

    var LoadSceneSectionView = Backbone.View.extend({
      el: $('.load-scene'),
      events: {
        'click .btn-load-scene' : 'onLoadClick',
        'click .load-scene-select' : 'onSelectClick',
      },
      dropdownMenuVisible: false,
      firstDropdownClick: true,

      render: function() {
        $.ajax({
          type: 'POST',
          url: '/api/getMyScenes',
          data: { acid: Init.getAcid() },
          success: (function(res) {
            console.log("FUCK");
            console.log(Init.getAcid());
            console.log(res);

            // populate the load-scenes dropdown box
            var selectBoxItem = _.template($('#t-select-box-item').html());
            var dropdownMenu = this.$('.load-scene-dropdown-box');
            dropdownMenu.empty();
            for (var i = 0; i < res.scenes.length; i++) {
              var scene = res.scenes[i];
              dropdownMenu.append(selectBoxItem({
                value: scene._id,
                label: scene.title
              }));
            }

            this.$('.load-scene-select')
              .select()
              .select('selectByIndex', 0)
              .select('resize');
          }).bind(this),
        });
      },

      onSelectClick: function() {
        // when we click the load-scene-select, this function changes the
        // height of the Load Scene section accordingly to keep the dropdown
        // menu from getting cut off.
        if (this.firstDropdownClick) {
          this.firstDropdownClick = false;
          this.baseHeight = this.$el.height();
          this.dropdownMenuHeight = this.$('.load-scene-dropdown-box').height();
        }

        var currentHeight = this.$el.height();
        var dropdownDisplay = this.$('.load-scene-dropdown-box').css('display');
        if (currentHeight === this.baseHeight && dropdownDisplay === 'none') {
          this.$el.height(this.baseHeight + this.dropdownMenuHeight);
        } else if (currentHeight === this.baseHeight + this.dropdownMenuHeight
            && dropdownDisplay === 'block') {
          this.$el.height(this.baseHeight);
        }
      },

      onLoadClick: function() {
        var createSceneDialog = mainViews[Router.HOME].getCreateSceneDialog();
        var selectedItem = this.$('.load-scene-select').select('selectedItem');
        createSceneDialog.loadScene(selectedItem.value);
      },
    });

    var CreateSceneDialogView = Backbone.View.extend({
      el: $('.createSceneModal'),
      events: {
        'click .btn-done' : 'onDoneClick',
      },

      initialize: function() {
        this.materialsTab = new MaterialCreatorView({creatorType: 'material'});
        this.objectsTab = new ObjectCreatorView({creatorType: 'object'});
        this.lightsTab = new LightCreatorView({creatorType: 'light'});
        this.thumbnailTab = new ThumbnailTabView();
        this.loadSceneSection = new LoadSceneSectionView();
      },

      render: function() {
        // The dialog was already rendered when the page loaded.
        // This is just for any additional rendering that needs to be done,
        // such as setting default values for some inputs.
        this.$('#inputAuthor').val(Init.getFbUserName());
        this.loadSceneSection.render();
        return this;
      },

      getLightsTab: function() {
        return this.lightsTab;
      },

      getMaterialsTab: function() {
        return this.materialsTab;
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
            acid: Init.getAcid(),
            scene: scene
          },
          success: (function(res) {
            console.log(scene);
            console.log('Success!');
            gallery.add(new GalleryItem(res.galleryItem));
            this.$el.modal('hide');
          }).bind(this),
          error: function(res) {
            console.log('Error creating scene!');
          },
        });
      },

      // given a scene id, load the scene into the dialog
      loadScene: function(sceneID) {
        $.ajax({
          type: 'POST',
          url: '/api/getSceneRenderingData',
          data: { sceneID: sceneID },
          success: (function(res) {
            var scene = res.scene;
            var width = scene.width;
            var height = scene.height;
            var camera = scene.camera;
            var lights = scene.lights;
            var materials = scene.materials;
            var objects = scene.objects;

            // set width and height 
            this.$('#inputWidth').val(width);
            this.$('#inputHeight').val(height);

            // set camera properties
            this.setVectorInput('inputEye', camera.eye);
            this.setVectorInput('inputViewDirection', camera.viewDirection);
            this.setVectorInput('inputUp', camera.up);
            this.$('#inputProjectionDistance').val(camera.projectionDistance);

            // set lights
            var lightsTab = this.getLightsTab();
            lightsTab.clearAddedItems();
            _.each(lights, function(light) {
              lightsTab.addItem({
                name: light.name,
                type: 'item',
                light: light
              });
            });
            lightsTab.render();

            // set materials
            var materialsTab = this.getMaterialsTab();
            materialsTab.clearAddedItems();
            for (var materialName in materials) {
              var material = materials[materialName];
              materialsTab.addItem({
                name: materialName,
                type: 'item',
                material: material
              });
            }
            materialsTab.render();

            // set objects
            var objectsTab = this.getObjectsTab();
            objectsTab.clearAddedItems();
            _.each(objects, function(object) {
              objectsTab.addItem({
                name: object.name,
                type: 'item',
                object: object
              });
            });
            objectsTab.render();

          }).bind(this),
        });

      },

      getSceneAsJSON: function() {
        var title = this.$('#inputTitle').val();
        var author = this.$('#inputAuthor').val();
        var thumbnailURL = this.$('#inputThumbnailURL').val();
        var width = this.$('#inputWidth').val();
        var height = this.$('#inputHeight').val();

        return {
          title: title,
          author: author,
          thumbnailURL: thumbnailURL,
          width: width,
          height: height,
          camera: this.gatherCamera(),
          lights: this.gatherLights(),
          materials: this.gatherMaterials(),
          objects: this.gatherObjects(),
        };
      },

      setVectorInput: function(id, vector) {
        this.$("#" + id + "-x").val(vector.x);
        this.$("#" + id + "-y").val(vector.y);
        this.$("#" + id + "-z").val(vector.z);
      },

      gatherVectorInput: function(id) {
        return {
          x: this.$("#" + id + "-x").val(),
          y: this.$("#" + id + "-y").val(),
          z: this.$("#" + id + "-z").val(),
        };
      },

      gatherCamera: function() {
        return {
          eye: this.gatherVectorInput('inputEye'),
          viewDirection: this.gatherVectorInput('inputViewDirection'),
          up: this.gatherVectorInput('inputUp'),
          projectionDistance: this.$('#inputProjectionDistance').val()
        };
      },

      gatherLights: function() {
        // a light is a (position, intensity) tuple
        // returns a list of lights
        var lights = [];
        var addedLights = this.getLightsTab().getAddedItems();
        for (var i = 0; i < addedLights.length; i++) {
          var light = addedLights[i].light;
          lights.push(light);
        }
        return lights;
      },

      gatherMaterials: function() {
        // returns a map of materialName -> materialProperties
        var materials = {};
        var addedMaterials = this.getMaterialsTab().getAddedItems();
        for (var i = 0; i < addedMaterials.length; i++) {
          var material = addedMaterials[i].material;
          materials[material.name] = material;
        }
        return materials;
      },

      gatherObjects: function() {
        // TODO: handle grouping
        var objects = [];
        var addedObjects = this.getObjectsTab().getAddedItems();
        for (var i = 0; i < addedObjects.length; i++) {
          var object = addedObjects[i].object;
          objects.push(object);
        }
        return objects;

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
      initialize: function() {
        SceneView.__super__.initialize.apply(this, arguments);
      },

      displayFinishedImage: function(imageFileName) {
        var imgTemplate = _.template($('#t-finished-image').html());
        var imgContainer = this.$('.finished-image-container');
        imgContainer.empty();
        imgContainer.html(imgTemplate({
          imgSrc : selectedScene.get('imageSrc')
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
            // TODO: resend request on error, or depends on the error
          },
          timeout: 5000
        });
      },

      render: function(sceneID) {
        this.$el.html(this.template({
          scene: selectedScene.toJSON(),
        })); 

        if (selectedScene.get('finishedRendering')) {
          this.displayFinishedImage();
        }
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
        this.model.on('change:thumbnailURL', this.onChangeThumbnail, this);
        this.render();
      },

      onChangeThumbnail: function() {
        this.render();
      },

      render: function() {
        this.$el.addClass('span4');
        this.$el.html(this.template({ scene: this.model.toJSON() }));
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
        gallery.bind('add', this.addGalleryItem, this);
        this.render();
      },

      render: function() {
        this.refreshGalleryData();
        return this;
      },

      addGalleryItem: function(galleryItem) {
        var galleryThumbnails = this.$('.gallery-thumbnails');
        var galleryItemView = new GalleryItemView({ model: galleryItem });
        galleryThumbnails.append(galleryItemView.render().el);
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

      refreshGalleryData: function() {
        $.ajax({
          type: 'POST',
          url: 'api/getPublishedScenes',
          data: {},
          success: (function(res) {
            console.log("getPublishedScenes Success");
            gallery.reset(res.scenes);
          }).bind(this),
        });
      },
    });

    mainViews[Router.HOME] = new HomeView;
    mainViews[Router.ABOUT] = new AboutView;
    mainViews[Router.CONTACT] = new ContactView;
    mainViews[Router.SCENE] = new SceneView;

    $('.create-scene-button').on('click', function(event) {
      mainViews[Router.HOME].getCreateSceneDialog().render();
    });
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
