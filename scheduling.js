var Scene = require('./models/scene').Scene;

module.exports = function(io) {
var fs = require('fs');
var PNG = require('pngjs').PNG;

var scenes = {}; // scenes being worked on. Maps sceneID -> RTScene

var TOLERANCE_TIME = 30*1000; // time we wait before reassigning work

// Job Class
// @param int id - job identifier
// @param array pixels - a pixel is a map {x, y}
var Job = function(id, startPixelIndex, endPixelIndex) {
  this.id = id;
  this.startPixelIndex = startPixelIndex;
  this.endPixelIndex = endPixelIndex;
//  this.pixels = pixels;
  this.workingClients = [];
};

Job.CHUNK_SIZE = 2500;

Job.prototype.getID = function() {
  return this.id;
};

Job.prototype.getWorkingClients = function() {
  return this.workingClients;
};

Job.prototype.addWorkingClient = function(client) {
  this.workingClients.push(client);
};

Job.prototype.clearWorkingClients = function() {
  this.workingClients = [];
};

Job.prototype.getPixels = function() {
  return this.pixels;
};

Job.prototype.toJSON = function() {
  return {
    id: this.id,
    startPixelIndex: this.startPixelIndex,
    endPixelIndex: this.endPixelIndex
  };
//  return { id: this.id, pixels: this.pixels };
};

// RTScene Class
// Scene to be ray traced and rendered into an image
var RTScene = function(id, width, height) {
  if (!width || !height) {
    console.log("Width or height was not specified!");
    this.width = 400;
    this.height = 300;
  } else {
    this.width = width;
    this.height = height;
  }
  this.totalPixels = width * height;
  this.id = id;

  // map holding all clients connected to this image
  this.connectedClients = {};

  // map holding all the jobs for this image
  this.allJobs = {}; // maps jobIDs to Jobs

  // map holding all job results for this image
  // A job result is a pixel->RGB mapping
  this.jobResults = {}; // maps jobIDs to results

  // Queue of jobs to be given to clients for this image
  this.jobQueue = [];

  // Keeps track if we've created the finished PNG image
  this.createdFinishedImage = false;
};

RTScene.indexToPixel = function(i) {
  return {
    x: i % this.width,
    y: Math.floor(i / this.width)
  };
};

RTScene.pixelToIndex = function(pixel) {
  return pixel.x + pixel.y*this.width;
};

// Add the client to this scene. Generate an identifier for
// this client to use with this particular scene.
// We generate a new ID instead of using the user's acid so that
// we can have the same user working on the same scene on more
// than one client (e.g. if user is logged in on multiple computers)
RTScene.prototype.addClient = function(userAcid, socket, callback) {
  var i = 0;
  var clientID = userAcid + "-" + i;

  // keep looping until we find a clientID that is not being used
  // by this userAcid on this particular scene.
  // This will become the client's identifier.
  while (!!this.connectedClients[clientID]) {
    i++;
    var clientID = userAcid + "-" + i;
  }

  this.connectedClients[clientID] = {
    id: clientID,

    // what job the client is currently working on
    job: null,

    // the socket holding this client's connection
    socket: socket,

    // when slowTimer goes off, we add this client's work back to the queue
    slowTimer: null,
  };

  callback(this, clientID);
};

RTScene.prototype.removeClient = function(clientID) {
  if (this.connectedClients[clientID]) {
    this.connectedClients[clientID] = undefined;
    delete this.connectedClients[clientID];
  }
};

RTScene.prototype.getClientByID = function(clientID) {
  return this.connectedClients[clientID];
};

// Create all the jobs for this image
// Iterate over image pixels and split it into jobs
RTScene.prototype.createJobs = function() {
  var jobID = 0;
  var chunk = [];
  var currentChunkSize = 0;
  var startPixelIndex = 0;

  for (var i = 0; i < this.height * this.width; i++) {
    currentChunkSize += 1;
    if (currentChunkSize === Job.CHUNK_SIZE) {
      this.allJobs[jobID] = new Job(
        jobID,
        startPixelIndex,
        startPixelIndex + currentChunkSize
      );
      currentChunkSize = 0;
      jobID += 1;
      startPixelIndex = i+1;
    }
  }

  // add the last chunk of pixels in case it didn't make it to Job.CHUNK_SIZE
  if (currentChunkSize > 0) {
    this.allJobs[jobID] = new Job(
      jobID,
      startPixelIndex,
      startPixelIndex + currentChunkSize
    );
  }
};

RTScene.prototype.pushJob = function(job) {
  this.jobQueue.push(job);
};

RTScene.prototype.pushAllJobsToQueue = function() {
  for (var id in this.allJobs) {
    this.pushJob(this.allJobs[id]);
  }
};

// Returns true if the client was assigned a job, otherwise false.
// We give the client the first job on the queue that hasn't already
// been completed. All jobs along the way are discarded because they
// are done.
RTScene.prototype.assignJobToClient = function(clientID, socket) {
  var client = this.connectedClients[clientID];
  while (this.jobQueue.length !== 0) {
    var job = this.jobQueue.shift();
    if (!this.jobResults[job.getID()]) { // if this job isn't already complete
      // give the job to the client
      client.job = job;
      socket.emit('jobAssignment', {
        sceneID: this.id,
        job: client.job.toJSON(),
      });

      // add the client to the job to keep track of who is working on it
      job.addWorkingClient(client);

      // begin the clients timer
      client.slowTimer = setTimeout((function() {
        // add the slow client's job back to the queue so it can
        // get picked up by someone else
        this.pushJob(job);
      }).bind(this), TOLERANCE_TIME);

      return true;
    }
  }
  return false;
};

// Returns true if job results are stored successfully, false otherwise.
RTScene.prototype.storeJobResults = function(clientID, jobID, results) {
  if (this.allJobs[jobID]) { // if we got the results for a valid job
    if (this.connectedClients[clientID]) {
      clearTimeout(this.connectedClients[clientID].slowTimer);
    }
    this.jobResults[jobID] = results;

    // now loop through all of the other clients that were working on this job
    // and assign them new jobs
    var job = this.allJobs[jobID];
    var workingClients = job.getWorkingClients();
    for (var i = 0; i < workingClients.length; i++) {
      var workingClient = workingClients[i];
      if (workingClient.job.getID() === jobID) {
        if (workingClient.id !== clientID) {
          clearTimeout(workingClient.slowTimer);
          this.assignJobToClient(workingClient.id, workingClient.socket);
        }
      }
    }

    return true;
  }
  return false;
};

RTScene.prototype.areAllJobsComplete = function() {
  for (var id in this.allJobs) {
    var job = this.allJobs[id];
    if (!this.jobResults[job.getID()]) {
      // if a job isn't complete then return false
      return false;
    }
  }
  return true;
};

RTScene.prototype.broadcastFinishedImage = function() {
  // Write to DB that the image is complete
  Scene
    .findOne({'_id': this.id})
    .exec((function(err, dbScene) {
      if (err || !dbScene) {
        console.log("Could not find scene to write that rendering completed.");
      } else {
        dbScene.finishedRendering = true;
        dbScene.save((function(err) {
          if (err) {
            console.log("Error writing that scene finished rendering.");
          } else {
            for (var clientID in this.connectedClients) {
              var client = this.getClientByID(clientID);
              client.socket.emit('finishedImage', { sceneID: this.id, });
            }
          }
        }).bind(this));
      }
    }).bind(this));

  // remove this scene from being scheduled for work
  scenes[this.id] = undefined;
  delete scenes[this.id];
};

RTScene.prototype.createFinishedImage = function(sceneID) {
  var png = new PNG({
    width: this.width,
    height: this.height,
    filterType: -1,
  });

  // Iterate over all pixels and write them to the rgb buffer
  for (var jobID in this.jobResults) {
    var pixels = this.jobResults[jobID];
    for (var i = 0; i < pixels.length; i++) {
      var p = pixels[i];
      var idx = (png.width * (this.height-p.y) + p.x) << 2;
      png.data[idx] = p.r * 255;
      png.data[idx+1] = p.g * 255;
      png.data[idx+2] = p.b * 255;
      png.data[idx+3] = 255;
    }
  }

  // Create PNG image
  var ws = fs.createWriteStream(
        __dirname + "/static/raytraced_images/" + sceneID + ".png"
    );
  png.pack().pipe(ws);
  this.createdFinishedImage = true;

  ws.on('close', (function(fd) {
    this.broadcastFinishedImage();
  }).bind(this));
};

// Schedule a scene to be rendered. It'll start once clients start connecting.
var addScene = function(sceneID, width, height) {
  var scene = new RTScene(sceneID, width, height);
  // split the scene into jobs, push them to the queue
  scene.createJobs();
  scene.pushAllJobsToQueue();

  scenes[sceneID] = scene;
  console.log("Current number of scenes being worked on: "
      + Object.keys(scenes).length);
};

// TODO: IMPORTANT: handle slow clients
io.sockets.on('connection', function(socket) {
  socket.clientSceneConnections = [];

  socket.on('connectToScene', function(data) {
    var userAcid = data.acid;
    var rtScene = scenes[data.sceneID];
    if (!rtScene) {
      console.log("Scene " + data.sceneID + " is no longer scheduled for work.");
      // TODO: tell user that the scene is no longer available for connection
      return;
    }

    console.log("Starting connection for user " + userAcid);

    Scene
      .findOne({ '_id': rtScene.id })
      .exec(function(err, dbScene) {
        if (err || !dbScene) {
          console.log("Could not find scene");
        } else {
          if (!dbScene.startedRendering) {
            dbScene.startedRendering = true;
          }
          dbScene.numUsersConnected = dbScene.numUsersConnected + 1;

          dbScene.save(function(err) {
            if (!err) {
              // updated scene successfully
              // add the client to this scene, and tell the client what
              // its identifier is for this scene
              rtScene.addClient(userAcid, socket, function(scene, clientID) {
                socket.clientSceneConnections.push(
                  { scene: scene, clientID: clientID });
                socket.emit('identifier',
                  { sceneID: scene.id, clientID: clientID });
              });
            } else {
              // TODO: emit to the client that there was an error, so
              // the button doesn't change to 'Connected'
              console.log(err);
            }
          });
        }
      });
  });

  // When the client is registered (i.e. the client has received its
  // identifier for a given scene), begin assigning jobs 
  socket.on('registeredClient', function(data) {
    var clientID = data.clientID;
    var scene = scenes[data.sceneID];
    if (!scene) {
      console.log("Scene " + data.sceneID + " is no longer scheduled for work.");
      // TODO: tell user that the scene is no longer available for connection
      return;
    }

    console.log("Client registered (" + clientID +
      ") for scene [" + data.sceneID + "]");
    scene.assignJobToClient(clientID, socket);
  });

  // received result for a given client/scene pair
  socket.on('jobResult', function(data) {
    var clientID = data.clientID;
    var scene = scenes[data.sceneID];
    var jobID = data.jobID;
    var pixels = data.pixels;

    if (!scene) {
      console.log("Scene " + data.sceneID + " is no longer scheduled for work.");
      // TODO: tell user that the scene is no longer available for connection
      return;
    }

    // store this client's results
    scene.storeJobResults(clientID, jobID, pixels);

    // assign a new job to this client
    var assignedJob = scene.assignJobToClient(clientID, socket);
    if (!assignedJob) {
      // we didn't assign a new job, so check if all jobs are done.
      if (scene.areAllJobsComplete()) {
        if (!scene.createdFinishedImage) {
          scene.createFinishedImage(scene.id);
        }
      }
    }
  });

  // client is requesting a new job
  socket.on('jobRequest', function(data) {
    var clientID = data.clientID;
    var scene = scenes[data.sceneID];
    scene.assignJobToClient(clientID, socket);
  });

  // disconnection because the client clicked on 'disconnect'
  socket.on('disconnectFromScene', function(data) {
    var clientID = data.clientID;
    var scene = scenes[data.sceneID];
    var disconnectedClient = scene.getClientByID(clientID);

    if (!disconnectedClient) {
      // client no longer exists for some reason
      return;
    }

    // add the client's job back to the queue
    if (disconnectedClient.job) {
      scene.pushJob(disconnectedClient.job);
    }

    // release memory for this client
    scene.removeClient(clientID);

    // remove this clientSceneConnection from the socket
    for (var i = 0; i < socket.clientSceneConnections.length; i++) {
      var connection = socket.clientSceneConnections[i];
      if (connection.scene.id === data.sceneID &&
          connection.clientID === clientID) {
        socket.clientSceneConnections.splice(i, 1);
        break;
      }
    }

    // decrease the numUsersConnected for this scene
    Scene
      .findOne({ '_id' : data.sceneID })
      .exec(function(err, dbScene) {
        if (err || !dbScene) {
          console.log("Could not find scene when trying to disconnect");
        } else {
          dbScene.numUsersConnected = dbScene.numUsersConnected - 1;
          dbScene.save(function(err) {
            if (!err) {
              // no error
            } else {
              // TODO: emit to the client that there was an error disconnecting
              // so the button doesn't change to 'Disconnected'
            }
          });
        }
      });
  });

  // disconnection because the client quit the browser or exited the app somehow
  socket.on('disconnect', function() {
    var sceneIDsToDisconnect = [];

    // break all client/scene connections being held by this socket
    for (var i = 0; i < socket.clientSceneConnections.length; i++) {
      var clientSceneConnection = socket.clientSceneConnections[i];
      var clientID = clientSceneConnection.clientID;
      var scene = clientSceneConnection.scene;
      sceneIDsToDisconnect.push(scene.id);

      var brokenClient = scene.getClientByID(clientID);
      if (!brokenClient) {
        // client no longer exists for some reason
        return;
      }

      // add the client's job back to the queue
      if (brokenClient.job) {
        scene.pushJob(brokenClient.job);
      }

      // release memory for this client
      scene.removeClient(clientID);
    }

    Scene.update(
      { _id: { $in: sceneIDsToDisconnect}},
      { $inc: { numUsersConnected: -1}},
      { multi: true },
      function(err) {
        if (err) {
          // nothing to do really, user already disconnected
        }
      }
    );
  });
});

  return {
    addScene: addScene
  };
};
