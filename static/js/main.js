/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 */

Main = (function() {
  var mainViews = {};
  var currentView = Router.HOME;
  var selectedScene = null; // the scene we are viewing

  var NO_PARENT = "###noparent###";

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
    var TreeDataSource = function(dataMap) {
      this._dataMap = Util.clone(dataMap);
    };

    TreeDataSource.prototype = {
      data: function(options, callback) {
        if (options.type === "folder") {
          // if this is a folder, only pass along the data in this folder
          var data = $.extend(true, {}, this._dataMap);
          var childrenNames = $.extend(true, [], options.children);
          var newData = [];
          for (var i = 0; i < childrenNames.length; i++) {
            var childName = childrenNames[i];
            newData.push(data[childName]);
          }
          callback({ data: newData });

        } else {
          // this is not a folder, i.e. this is the root,
          // so only add items that have no parent
          var data = $.extend(true, {}, this._dataMap);
          var newData = [];
          for (var name in data) {
            if (!data[name].parent || data[name].parent === NO_PARENT) {
              newData.push(data[name]);
            }
          }
          callback({ data: newData });
        }
      },
    };

    var ConnectSceneButtonView = Backbone.View.extend({
      connected: false,
      events: {
        'click' : 'onConnectClick',
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

          // now disconnect from the scene
          Client.disconnectFromScene(this.model.id);
        }
      },
    });

    // Base View for the ObjectCreator and MaterialCreator Views
    var BaseCreatorView = Backbone.View.extend({
      selectedItem: "", // what item type we've currently selected
      isEditing: false,
      itemBeingEdited: "",

      initialize: function(options) {
        this.creatorType = options.creatorType;
      },

      clearAddedItems: function() {
        this.addedItems = {};
      },

      addItem: function(item) {
        this.addedItems[item.name] = item;
      },

      editItem: function(item) {
        this.addedItems[this.itemBeingEdited] = undefined;
        delete this.addedItems[this.itemBeingEdited];
        this.addedItems[item.name] = item;
      },

      getAddedItems: function() {
        return this.addedItems;
      },

      getAddedItemsAsArray: function() {
        return Util.objectToArray(this.addedItems);
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

      rgbToString: function(color) {
        var rgb = Util.clone(color);
        for (var id in rgb) {
          rgb[id] = Math.round(rgb[id] * 255);
        }
        return "rgb("+rgb.r+","+rgb.g+","+rgb.b+")";
      },

      setColorInput: function(id, rgb) {
        var rgbString = this.rgbToString(rgb);
        this.$("#" + id).val(rgbString);
        this.$("#" + id).parent().attr('data-color', rgbString);
        this.$("#" + id).parent().colorpicker('setValue', rgbString);
      },

      gatherVectorInput: function(id) {
        return {
          x: this.$("#" + id + "-x").val(),
          y: this.$("#" + id + "-y").val(),
          z: this.$("#" + id + "-z").val(),
        };
      },

      setVectorInput: function(id, vector) {
        this.$("#" + id + "-x").val(vector.x);
        this.$("#" + id + "-y").val(vector.y);
        this.$("#" + id + "-z").val(vector.z);
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

      getTreeElement: function() {
        return this.$(".added-" + this.creatorType + "s-tree");
      },

      addEditIcons: function() {
        this.$('.icon-pencil').remove();

        // link each DOM tree-element to its name
        var folderNameElements = this.$(".tree-folder-name:not(:first)");
        var itemNameElements = this.$(".tree-item-name:not(:first)");
        _.each(folderNameElements, function(elt) {
          var e = $(elt);
          e.parent().parent().data('name', e.text());
        });

        _.each(itemNameElements, function(elt) {
          var e = $(elt);
          e.parent().data('name', e.text());
        });

        // add the edit-icons and link them to their respective items
        var addedItems = this.getAddedItems();
        var treeItems = this.$(".tree-item:not(:first)," +
            ".tree-folder:not(:first)");
        for (var i = 0; i < treeItems.length; i++) {
          var treeItem = $(treeItems[i]);
          var item = addedItems[treeItem.data('name')];
          var editIcon = $('<i class="icon-pencil"></i>');
          editIcon.data('name', item.name);
          treeItem.append(editIcon);
          editIcon.on('click', this.onEditClick.bind(this));
        }
      },

      renderTree: function() {
        var addedItemsEl = this.$(".added-"+this.creatorType+"s");
        var treeTemplate = _.template($('#t-item-folder-tree').html());
        var treeClass = "added-"+this.creatorType+"s-tree";

        this.getTreeElement().remove();
        addedItemsEl.empty();
        addedItemsEl.html(treeTemplate({ className: treeClass }));

        this.getTreeElement().tree({
          dataSource: new TreeDataSource(this.getAddedItems()),
          multiSelect: true,
        });

        this.addEditIcons();

        // make sure that pencil icons stay floating to the right
        // (fuelux's Tree component keeps trying to move it back to the left)
        this.getTreeElement().on('click', (function() {
          this.$('.icon-pencil').removeClass('icon-ok');
          this.$('.icon-pencil').removeClass('tree-dot');
        }).bind(this));

        return this;
      },

      onEditClick: function(event) {
        event.stopPropagation();
        var itemName = $(event.target).data('name');
        this.isEditing = true;
        this.itemBeingEdited = itemName;

        // change form heading text
        var tabTitle = this.$("h5");
        if (!tabTitle.data('oldTitle')) {
          tabTitle.data('oldTitle', tabTitle.text());
        }
        tabTitle.text("Editing " + itemName);

        // change form buttons
        this.$(".btn-add-"+this.creatorType).val('Save');
        this.$(".btn-add-"+this.creatorType).addClass('btn-success');
        this.$(".btn-add-"+this.creatorType).removeClass('btn-primary');
        this.$(".btn-cancel-"+this.creatorType).show();

        this.populateEditableInputs(itemName);
      },

      onCancelEditClick: function(event) {
        this.isEditing = false;

        // Set form heading text back to old text
        var tabTitle = this.$("h5");
        tabTitle.text(tabTitle.data('oldTitle'));
        tabTitle.data('oldTitle', undefined);

        // change form buttons back
        this.$(".btn-add-"+this.creatorType).val('Add');
        this.$(".btn-add-"+this.creatorType).addClass('btn-primary');
        this.$(".btn-add-"+this.creatorType).removeClass('btn-success');
        this.$(".btn-cancel-"+this.creatorType).hide();
      },

      removeSelectedItems: function() {
        var treeEl = this.getTreeElement();
        var selectedItems = treeEl.tree('selectedItems');
        for (var i = 0; i < selectedItems.length; i++) {
          var itemName = selectedItems[i].name;
          this.addedItems[itemName] = undefined;
          delete this.addedItems[itemName];
        }
        this.renderTree();
      },
    });

    // View for the Lights tab in the Create Scene modal dialog
    // This is more straightforward than ObjectCreator and MaterialCreatorView
    // because lights don't have multiple types, so we don't need to keep track
    // of the possible types and their properties
    var LightCreatorView = BaseCreatorView.extend({
      el: $('.lights-tab'),
      addedItems: {},

      events: {
        'click .btn-add-light' : 'onAddClick',
        'click .btn-cancel-light' : 'onCancelEditClick',
        'click .btn-remove-selected-lights' : 'removeSelectedItems',
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

        var itemToAdd = {
          name: light.name,
          type: 'item',
          light: light
        };

        if (this.isEditing) {
          this.editItem(itemToAdd);
        } else {
          this.addItem(itemToAdd);
        }
        this.onCancelEditClick(); // added/edited item, now cancel out of editing
        this.renderTree();
      },

      // called when the edit icon is clicked for lights
      populateEditableInputs: function(itemName) {
        var light = this.addedItems[itemName].light;
        this.$('#inputLightName').val(light.name);
        this.setVectorInput('inputLightPos', light.position);
        this.setColorInput('inputLightColor', light.color);
        this.$('#inputLightIntensity').val(light.intensity);
      }
    });

    // View for the Objects tab in the Create Scene modal dialog
    var ObjectCreatorView = BaseCreatorView.extend({
      el: $('.objects-tab'),
      addedItems: {},

      events: {
        'changed .object-select' : 'onObjectSelect',
        'click .btn-add-object' : 'onAddClick',
        'click .btn-cancel-object' : 'onCancelEditClick',
        'click .btn-remove-selected-objects' : 'removeSelectedItems',
        'opened .tree' : 'onOpenTreeFolder',
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

      getAllGroupItems: function() {
        var addedItems = this.getAddedItems();
        var result = {};
        for (var itemName in addedItems) {
          if (addedItems[itemName].type === 'folder') {
            result[itemName] = addedItems[itemName]
          }
        }
        return result;
      },

      // called when the edit icon is clicked for objects
      populateEditableInputs: function(itemName) {
        var object = this.addedItems[itemName].object;
        this.$('#inputObjectName').val(object.name);

        // set type
        var type = object.type;
        var selectBox = this.$(".object-select");
        selectBox.select('selectByValue', type);
        this.onObjectSelect(null, selectBox.select('selectedItem'));

        // set form based on properties
        var objectProperties = this.itemTypes[type].properties;
        for (var propertyName in objectProperties) {
          var property = objectProperties[propertyName];
          var value = object[propertyName];
          if (property.type === 'vector') {
            this.setVectorInput(propertyName, value);
          } else if (property.type === 'material-select' ||
              property.type === 'group-select') {
            this.$("#" + propertyName).select('selectByValue', value);
          } else {
            this.$("#" + propertyName).val(value);
          }
        }

        // set transformations
        this.$('#scale').val(object.scale.x);
        this.setVectorInput('rotate', object.rotate);
        this.setVectorInput('translate', object.translate);
      },

      onOpenTreeFolder: function(event) {
        this.addEditIcons();
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
          } else if (property.type === 'material-select' ||
              property.type === 'group-select') {
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

        var itemToAdd = {
          name: object.name,
          type: object.type === 'group' ? 'folder' : 'item',
          object: object
        };

        var itemDoesntExist = !this.getAddedItems()[itemToAdd.name];
        if (itemDoesntExist) {
          itemToAdd.parent = NO_PARENT;
        } else {
          itemToAdd.parent = this.getAddedItems()[itemToAdd.name].parent;
        }

        // start out group
        if (object.type === 'group') {
          console.log(this.getAddedItems()[object.name]);
          itemToAdd.children = itemDoesntExist ?
            [] : this.getAddedItems()[object.name].children;
        }

        if (itemToAdd.parent !== NO_PARENT) {
          // find this item's parent and remove this item
          var parentGroup = this.getAddedItems()[itemToAdd.parent];
          parentGroup.children = _.reject(parentGroup.children,
              function(childName) { return childName === itemToAdd.name; });
        }

        // now set the new parent, and add this child
        itemToAdd.parent = object.group;
        if (itemToAdd.parent !== NO_PARENT) {
          var parentGroup = this.getAddedItems()[itemToAdd.parent];
          parentGroup.children.push(itemToAdd.name);
        }

        if (this.isEditing) {
          this.editItem(itemToAdd);
        } else {
          this.addItem(itemToAdd);
        }
        this.onCancelEditClick(); // added/edited item, now cancel out of editing
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
        properties.group = {label: 'Group', type: 'group-select'};

        // render the form
        var template = _.template($('#t-object-properties-form').html());
        var objectPropertiesForm = this.$('.object-properties-form');
        objectPropertiesForm.empty();
        objectPropertiesForm.html(template({
          properties: properties,
        }));

        var selectBoxItem = _.template($('#t-select-box-item').html());
        // if this is not a Group, then add the select-materials dropdown items
        if (this.selectedItem !== 'group') {

          // set the select-materials dropdown
          var materials = this.getMaterialsTab().getAddedItems();
          var materialDropdownMenu = this.$('.object-materials-dropdown-box');
          materialDropdownMenu.empty();
          for (var materialName in materials) {
            var material = materials[materialName].material;
            materialDropdownMenu.append(selectBoxItem({
              value: material.name,
              label: material.name,
            }));
          }
          this.$('.object-material-select').select();
        }

        // add the select-group dropdown
        var groups = this.getAllGroupItems();
        var groupDropdownMenu = this.$('.object-group-dropdown-box');
        groupDropdownMenu.empty();
        groupDropdownMenu.append(selectBoxItem({
          value: NO_PARENT, label: "No Group"
        }));

        for (var groupName in groups) {
          var group = groups[groupName].object;
          groupDropdownMenu.append(selectBoxItem({
            value: group.name,
            label: group.name
          }));
        }
        this.$('.object-group-select').select();

      },
    });

    // View for the Materials tab in the Create Scene modal dialog
    var MaterialCreatorView = BaseCreatorView.extend({
      el: $('.materials-tab'),
      addedItems: {},

      events: {
        'changed .material-select' : 'onMaterialSelect',
        'click .btn-add-material' : 'onAddClick',
        'click .btn-cancel-material' : 'onCancelEditClick',
        'click .btn-preview-material' : 'onPreviewMaterialClick',
        'click .btn-remove-selected-materials' : 'removeSelectedItems',
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

      gatherMaterialFromInput: function() {
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

        return material;
      },

      onPreviewMaterialClick: function(event) {
        var material = this.gatherMaterialFromInput();

        var materials = {};
        materials[material.name] = material;

        var camera = {
          eye: { x:0, y:0, z:1 },
          viewDirection: { x:0, y:0, z:-1 },
          up: { x:0, y:1, z:0 },
          projectionDistance: 1,
        };

        var light = {
          position: { x:-2, y:3, z:1 },
          color: { r:1, g: 1, b: 1},
          intensity: 1
        };

        var sphere = {
          type: 'sphere',
          center: { x:0, y:0, z:-5 },
          radius: 1,
          shader: material.name,
          scale: { x:1, y:1, z:1 },
          rotate: { x:0, y:0, z:0 },
          translate: { x:0, y:0, z:0 },
        };

        var width = 200;
        var height = 200;
        var canvasID = 'preview-material-canvas';

        var scene = {
          width: width,
          height: height,
          camera: camera,
          canvasID: canvasID,
          lights: [ light ],
          materials: materials,
          objects: [ sphere ],
        }

        var rtScene = RayTracer.createRenderableCanvasSceneFromJSON(scene);

        $('.preview-material-popup').show();
        RayTracer.renderImage(rtScene);
      },

      // called when the edit icon is clicked for materials 
      populateEditableInputs: function(itemName) {
        var material = this.addedItems[itemName].material;
        this.$('#inputMatName').val(material.name);
        
        // set type
        var type = material.type;
        var selectBox = this.$(".material-select");
        selectBox.select('selectByValue', type);
        this.onMaterialSelect(null, selectBox.select('selectedItem'));

        // set form based on properties
        var materialProperties = this.itemTypes[type].properties;
        for (var propertyName in materialProperties) {
          var property = materialProperties[propertyName];
          var value = material[propertyName];
          if (property.type === 'color') {
            this.setColorInput(propertyName, value);
          } else {
            this.$("#" + propertyName).val(value);
          }
        }
      },

      onAddClick: function(event) {
        var material = this.gatherMaterialFromInput();

        var itemToAdd = {
          name: material.name,
          type: 'item',
          material: material,
        };

        if (this.isEditing) {
          this.editItem(itemToAdd);
        } else {
          this.addItem(itemToAdd);
        }
        this.onCancelEditClick(); // added/edited item, now cancel out of editing
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
        'click .btn-preview-scene' : 'onPreviewSceneClick',
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

      onPreviewSceneClick: function() {
        var scene = this.getSceneAsJSON();
        console.log(scene);

        // set all materials to be lambertian
        for (var key in scene.materials) {
          var material = scene.materials[key];
          material.type = 'lambertian';
          material.diffuseColor = { r: 0.75, g: 0.75, b: 0.75 };
        }

        var canvasID = 'preview-scene-canvas';
        var width = 300;
        var height = 200;

        scene.canvasID = canvasID;
        scene.width = width;
        scene.height = height;
        $("#" + canvasID).attr('height', height);
        $("#" + canvasID).attr('width', width);

        var rtScene = RayTracer.createRenderableCanvasSceneFromJSON(scene);
        $('.preview-scene-popup').show();
        RayTracer.renderImage(rtScene);
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
            console.log('Successful scene creation!');
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
            // TODO: set objects with children and proper groups
            var objectsTab = this.getObjectsTab();
            objectsTab.clearAddedItems();
//            var objectsToAdd = _.map(objects, function(o) { return o; });
            var objectsToAdd = $.extend(true, [], objects);

            for (var i = 0; i < objectsToAdd.length; i++) {
              var obj = objectsToAdd[i];
              var children = [];

              // add all children to objectsToAdd array
              _.each(obj.objects, function(o) {
                o.parent = obj.name;
                objectsToAdd.push(o);
                children.push(o.name);
              });

              // add this object to the objects tab
              objectsTab.addItem({
                name: obj.name,
                object: obj,
                type: obj.type === 'group' ? 'folder' : 'item',
                children: children,
                parent: obj.parent ? obj.parent : NO_PARENT,
              });
            }

            /*
            _.each(objects, function(object) {
              objectsTab.addItem({
                name: object.name,
                type: 'item',
                object: object
              });
            });
            */
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
        for (var lightName in addedLights) {
          var light = addedLights[lightName].light;
          lights.push(Util.clone(light));
        }
        return lights;
      },

      gatherMaterials: function() {
        // returns a map of materialName -> materialProperties
        var materials = {};
        var addedMaterials = this.getMaterialsTab().getAddedItems();
        for (var materialName in addedMaterials) {
          var material = addedMaterials[materialName].material;
          materials[material.name] = Util.clone(material);
        }
        return materials;
      },

      objectItemToSceneObject: function(objectItem, allObjectItems) {
        var object = objectItem.object;
        object.objects = [];
        if (objectItem.children) {
          for (var i = 0; i < objectItem.children.length; i++) {
            var childName = objectItem.children[i];
            var childItem = allObjectItems[childName];
            var childObject = this.objectItemToSceneObject(childItem, allObjectItems);
            console.log(childObject);
            object.objects.push(childObject);
          }
        }
        return Util.clone(object);
      },

      gatherObjects: function() {
        // TODO: handle grouping
        var objects = [];
        var addedObjects = this.getObjectsTab().getAddedItems();
        var rootObjectItems = [];
        for (var objectName in addedObjects) {
          if (addedObjects[objectName].parent === NO_PARENT) {
            rootObjectItems.push(addedObjects[objectName]);
          }
        }

        for (var i = 0; i < rootObjectItems.length; i++) {
          var rootObjectItem = rootObjectItems[i];
          objects.push(this.objectItemToSceneObject(rootObjectItem, addedObjects));
        }

        /*
        for (var objectName in addedObjects) {
          var object = addedObjects[objectName].object;
          objects.push(Util.clone(object));
        }
        */
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
          this.$('.btn-connect')[0].remove();
        } else {
          if (this.connectButtonView) {
            this.connectButtonView.remove();
          }
          this.connectButtonView = new ConnectSceneButtonView({
            model: selectedScene
          }).setElement(this.$('.btn-connect'));
        }

        return this;
      },
    });

    var GalleryItemView = Backbone.View.extend({
      tagName: 'li',
      template: _.template($('#t-gallery-thumbnail').html()),

      initialize: function(options) {
        this.model.on('change:thumbnailURL', this.onChangeThumbnail, this);
        this.connectButtonView = new ConnectSceneButtonView({ model: this.model });
        this.render();
      },

      onChangeThumbnail: function() {
        this.render();
      },

      render: function() {
        this.$el.addClass('span4');
        this.$el.html(this.template({ scene: this.model.toJSON() }));

        // register the connect button view
        var btn = this.$('.btn-connect')[0];
        if (btn) {
          this.connectButtonView.setElement(btn);
        }

        return this;
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
