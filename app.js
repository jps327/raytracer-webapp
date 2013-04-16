var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var PNG = require('pngjs').PNG;
var path = require('path');
var mongoose = require('mongoose');

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

// Routes

app.get('/', function(req, res){
  res.render('index', { staticRoot : staticRoot });
});

// MongoDB connection

/*
mongoose.connect('mongodb://localhost/distributed_raytracer');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var SceneSchema = new Schema({
  id: ObjectId,
  title: String,
  author: String,
  date: { type: Date, default: Date.now },
  numUsersConnected: { type: Number, min: 0, default: 0 },
  objects: [Schema.Types.Mixed],
});

var Scene = mongoose.model('Scene', SceneSchema);
*/

app.post('/api/createScene', function(req, res) {
  var scene = new Scene();
  scene.title = req.title;
  scene.author = req.author;
  scene.date = Date.now();
  scene.numUsersConnected = 0;

  // Set up objects in scene
  scene.objects = req.objects;

  scene.save(function(err) {
    // nop
  });

});



// Job Class
// @param int id - job identifier
// @param array pixels - a pixel is a map {x, y}
var Job = function(id, pixels) {
  this.id = id;
  this.pixels = pixels;
};
Job.CHUNK_SIZE = 2500;
Job._currentID = 0;
Job.generateID = function() {
  Job._currentID += 1;
  return Job._currentID;
};
Job.prototype.getID = function() {
  return this.id;
};
Job.prototype.getPixels = function() {
  return this.pixels;
};
Job.prototype.toJSON = function() {
  return { id: this.id, pixels: this.pixels };
};

var allJobs = {}; // maps jobIDs to Jobs
var jobResults = {}; // maps jobIDs to results (the pixel-RGB mappings)
var jobQueue = []; // queue of jobs to be given to clients

// Split image into jobs
// TODO: do this for each different image to be rendered. Currently we
// are only ever rendering one image because the webapp isn't done.
var width = 400;
var height = 300;
var totalPixels = width * height;

var indexToPixel = function(i) {
  return {
    x: i % width,
    y: Math.floor(i / width)
  };
};

var pixelToIndex = function(pixel) {
  return pixel.x + pixel.y*width;
};

// Iterate over image pixels and split it into jobs
var createJobs = function() {
  var chunk = [];
  var currentChunkSize = 0;
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      chunk.push({ x: x, y: y});
      currentChunkSize += 1;
      if (currentChunkSize === Job.CHUNK_SIZE) {
        var jobID = Job.generateID();
        allJobs[jobID] = new Job(jobID, chunk);
        chunk = [];
        currentChunkSize = 0;
      }
    }
  }
  if (currentChunkSize > 0) {
    var jobID = Job.generateID();
    allJobs[jobID] = new Job(jobID, chunk);
  }
};

var areAllJobsComplete = function() {
  for (var id in allJobs) {
    var job = allJobs[id];
    if (!jobResults[job.getID()]) {
      // if a job isn't complete then return false
      return false;
    }
  }
  return true;
};

var createdFinishedImage = false;

var broadcastFinishedImage = function() {
  for (var clientID in clients) {
    var client = clients[clientID];
    client.socket.emit('finishedImage', "result.png");
  }
};

var createFinishedImage = function() {
  var png = new PNG({
    width: width,
    height: height,
    filterType: -1,
  });

  // Iterate over all pixels and write them to the rgb buffer
  for (var jobID in jobResults) {
    var pixels = jobResults[jobID];
    for (var i = 0; i < pixels.length; i++) {
      var p = pixels[i];
      var idx = (png.width * (height-p.y) + p.x) << 2;
      png.data[idx] = p.r * 255;
      png.data[idx+1] = p.g * 255;
      png.data[idx+2] = p.b * 255;
      png.data[idx+3] = 255;
    }
  }

  // Create PNG image
  var ws = fs.createWriteStream(
        __dirname + "/static/raytraced_images/" + "result.png"
    );
  png.pack().pipe(ws);
  createdFinishedImage = true;

  ws.on('close', function(fd) {
    broadcastFinishedImage();
  });
};

createJobs();

// add all jobs to the queue
for (var id in allJobs) {
  jobQueue.push(allJobs[id]);
}

// Job Scheduling
var clientID = 0;
var clients = {}; // maps clientIDs to clients

// TODO: handle slow clients
io.sockets.on('connection', function(socket) {
  clientID += 1;
  socket.clientID = clientID;

  // returns true if the client was assigned a job, otherwise false
  // we give the client the first job on the queue that hasn't already
  // been completed. All jobs along the way are discarded.
  var assignJobToClient = function(clientID) {
    var client = clients[clientID];
    while (jobQueue.length !== 0) {
      var job = jobQueue.shift();
      if (!jobResults[job.getID()]) { // if this job isn't already complete
        // give the job to the client
        client.job = job;
        socket.emit('jobAssignment', client.job.toJSON());
        return true;
      }
    }
    return false;
  };

  var client = {
    socket: socket,
    speed: null, // how fast this client goes
    job: null // what job the client is currently working on
  };

  // Add this client to our clients map
  clients[socket.clientID] = client;

  // TODO: add client to clients map when we get this event?
  // or do we add them to the map before this event (as we currently do)?
  socket.on('connectToScene', function() {
    // TODO: when we have multiple scenes being worked on, we need
    // to assign this client to a particular one. the client can't
    // become available to ALL images.

    // tell the client its ID so it can register itself
    socket.emit('identifier', socket.clientID);
  });

  // When client is registered, begin assigning jobs 
  socket.on('registeredClient', function(id) {
    console.log("client registered! " + id);
    assignJobToClient(id);
  });

  socket.on('jobResult', function(data) {
    // received result
    var clientID = data.clientID;
    var jobID = data.jobID;
    var pixels = data.pixels;

    console.log("Job Result for job " + jobID);

    // store job results
    if (allJobs[jobID]) { // if we got the results for a valid job
      jobResults[jobID] = pixels;
    }

    // assign a new job to this client
    var assignedJob = assignJobToClient(clientID);
    if (!assignedJob) {
      // we didn't assign a new job, so check if all jobs are done.
      if (areAllJobsComplete()) {
        if (!createdFinishedImage) {
          createFinishedImage();
        }
      }
    }
  });

  socket.on('disconnect', function() {
    var brokenClient = clients[socket.clientID];
    if (!brokenClient) {
      return;
    }
    // add the client's job back to the queue
    if (brokenClient.job) {
      jobQueue.push(brokenClient.job);
    }

    // release memory
    delete clients[socket.clientID];
  });

});
