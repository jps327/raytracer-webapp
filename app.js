var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = module.exports = require('socket.io').listen(server);
var credentials = require('./credentials');
var scheduling = require('./scheduling')(io);

var uuid = require('node-uuid');
var querystring = require('querystring');
var request = require('request');

var Scene = require('./models/scene').Scene;
var User = require('./models/user').User;

// Configuration
var port = process.env.PORT || 1337;
var staticRoot = '/';

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'hbs');

  app.use(express.static(__dirname + '/static'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

server.listen(port);

// API success and failure functions
var success = function(res, data) {
  if (!data) {
    data = {};
  }
  res.json(data);
}

var error = function(res, data, code) {
  if (!data) {
    data = {};
  }
  if (!code) {
    code = 400;
  }
  res.json(data, code);
}

// Start up everything by looking through the DB for all scenes
// that have not been finished, and schedule them to be worked on.
Scene
  .find({ finishedRendering: false })
  .exec(function(err, scenes) {
    if (err) {
      console.log("Unfinished scenes were not loaded back to be scheduled.");
    } else {
      for (var i = 0; i < scenes.length; i++) {
        var scene = scenes[i];
        scheduling.addScene(scene._id, scene.width, scene.height);
      }
    }
  });

// Routes

app.get('/', function(req, res){
  res.render('index', { staticRoot : staticRoot });
});

app.post('/api/getAcidFb', function(req, res) {
  var data = req.body;
  var accessToken = data.accessToken;
  var userID = data.userID;

  // Basic sanity check
  if (!accessToken || !userID) {
    error(res);
    return;
  }

  var username = 'fb:' + userID;
  User
    .findOne({ 'username': username })
    .select({ username: 1, acid: 1 })
    .exec(function(err, user) {
      if (err || !user || !user.fb) {
        console.log("New user with FB ID: " + userID);
        // User doesn't already exist, so go through the entire flow
        getExtendedToken(req, res, accessToken, userID,
          function(newAccessToken, newExpires) {
            getOrCreateUser(req, res, newAccessToken, userID, newExpires);
          });
      } else {
        console.log("Existing user with FB ID: " + userID);
        // User already exists, we know their info, so just exit quickly
        success(res, { acid: user.acid });
      }
    });
});

var getExtendedToken = function(req, res, accessToken, userID, callback) {
  // Convert token to an extended access token.
  // In the process, validate that this token is correct.
  var url = 'https://graph.facebook.com/oauth/access_token?';
  var params = {
    client_id: credentials.fb.appId,
    client_secret: credentials.fb.appSecret,
    grant_type: 'fb_exchange_token',
    fb_exchange_token: accessToken
  };
  url += querystring.stringify(params);
  request({url: url, timeout: 10000}, function(err, response, body) {
    if (err) {
      error(res);
    } else {
      var contentType = response.headers['content-type'];
      var data;
      if (contentType.indexOf('text/javascript') != -1) {
        // parse as JSON
        data = JSON.parse(body);
      } else {
        data = querystring.parse(body);
      }

      if (data.error) {
        error(res);
      } else {
        // set new tokens, continue on our quest
        var accessToken = data.access_token;
        var expires = parseInt(data.expires);
        callback(accessToken, expires);
      }
    }
  });
};

var getOrCreateUser = function(req, res, accessToken, userID, expires) {
  var username = 'fb:' + userID;
  User
    .findOne({'username': username})
    .exec(function(err, user) {
      if (err) {
        error(res);
        return;
      }
      var acid;
      var isNewUser;
      if (user) {
        // Update existing user
        user.fb.accessToken = accessToken;
        acid = user.acid;
        isNewUser = false;
      } else {
        // Create a new user
        var user = new User();
        user.username = username;
        user.fb = {
          accessToken: accessToken,
          userID: userID,
        };
        // Get and set a unique acid
        acid = uuid.v4();
        isNewUser = true;
      }

      user.acid = acid;
      user.fb.expires = new Date(Date.now() + expires * 1000);
      user.save(function(err) {
        if (!err) {
          success(res, { acid: acid });
          // asynchronously get info about this user, store it in DB
          getUserInfo(req, res, accessToken, userID, isNewUser);
        } else {
          console.log(err);
          error(res);
        }
      });
    });
};

var getUserInfo = function(req, res, accessToken, userID, isNewUser) {
  var username = 'fb:' + userID;
  User
    .findOne({'username': username})
    .exec(function(err, user) {
      if (err || !user) {
        return;
      }
      // Request details from FB
      var url = 'https://graph.facebook.com/me?access_token=' + accessToken;
      var options = {
        encoding: 'utf-8',
        method: 'GET',
        followRedirect: false,
        body: "",
        url: url
      };
      request(options, function(err, response, body) {
        if (err) {
          return;
        }
        var contentType = response.headers['content-type'];
        var data;
        if (contentType.indexOf('text/javascript') != -1) {
          // parse as JSON
          data = JSON.parse(body);
          user.fb.name = {
            full: data.name,
            first: data.first_name,
            last: data.last_name
          };
          user.fb.gender = data.gender;
          user.fb.email = data.email;
          user.fb.timezone = data.timezone;
          user.fb.updatedTime = data.updated_time;
          user.save(function(err) {
            // TODO: do something with err
          });
        }
      });

    });
};

// Adds a scene to the DB
app.post('/api/createScene', function(req, res) {
  var scene = req.param('scene');
  var acid = req.param('acid');

  var sceneObj = new Scene({
    title: scene.title,
    author: scene.author,
    createdByAcid: acid,
    thumbnailURL: scene.thumbnailURL,
    date: Date.now(),
    numUsersConnected: 0,
    camera: scene.camera,
    lights: scene.lights,
    materials: scene.materials,
    objects: scene.objects,
    height: scene.height,
    width: scene.width,
    samples: scene.samples,
    published: true,
    startedRendering: false,
    finishedRendering: false,
  });

  sceneObj.save(function(err) {
    if (!err) {
      // scene has been created, so it is now ready for job scheduling
      scheduling.addScene(sceneObj._id, sceneObj.width, sceneObj.height);
      success(res, {
        galleryItem: {
          _id: sceneObj._id,
          title: scene.title,
          author: scene.author,
          numUsersConnected: 0,
          thumbnailURL: scene.thumbnailURL,
          finishedRendering: false,
        }
      });
    } else {
      console.log(err);
      error(res);
    }
  });
});

// TODO: implement pagination
// gets the basic info for all published scenes (title, author,
// numUsersConnected, and whether or not the scene has finished rendering)
app.post('/api/getPublishedScenes', function(req, res) {
  var query = Scene.find({ published: true });
  query.select({title: 1, author: 1, numUsersConnected: 1,
    thumbnailURL: 1, finishedRendering: 1});
  query.exec(function(err, scenes) {
    if (err) {
      error(res);
    } else {
      success(res, {scenes: scenes});
    }
  });
});

// Returns information about the scene, e.g. title, author, filename, etc.
app.post('/api/getSceneInfo', function(req, res) {
  var sceneID = req.param('sceneID');
  Scene
    .findOne({ '_id': sceneID })
    .select({title: 1, author: 1, numUsersConnected: 1, finishedRendering: 1})
    .exec(function(err, scene) {
      if (err || !scene) {
        console.log("Could not find scene.");
        error(res);
      } else {
        success(res, {scene: scene});
      }
    });
});

// Returns the scene rendering data (e.g. materials, objects, lights, etc.)
app.post('/api/getSceneRenderingData', function(req, res) {
  var sceneID = req.param('sceneID');
  Scene
    .findOne({ '_id': sceneID })
    .select({width: 1, height: 1, samples: 1, camera: 1, lights: 1, materials: 1, objects: 1})
    .exec(function(err, scene) {
      if (err || !scene) {
        console.log("Could not find scene.");
        error(res);
      } else {
        success(res, { scene: scene });
      }
    });
});

// Gets all of the scenes saved or published by a given user acid
app.post('/api/getMyScenes', function(req, res) {
  var acid = req.param('acid');
  Scene
    .find({ createdByAcid: acid })
    .select({ title: 1})
    .exec(function(err, scenes) {
      if (err) {
        error(res);
      } else {
        success(res, {scenes: scenes});
      }
    });
});
