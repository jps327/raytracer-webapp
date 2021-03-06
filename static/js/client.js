/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 * Description: Client-side ray tracing
 */

/**
 * 1. Client connects to a scene
 * 2. Server sends back a client ID to link the client to this scene
 * 3. Client tells the server it has been successfully registered to this scene
 * 4. Server starts assigning jobs to this client
 * 5. Client renders the pixels, and sends back results
 * 6. Server sends the finished image
 */

Client = (function() {
  // scenes this client is working on paired with their respective clientID
  var sceneConnections = {};

  // amount of time to wait after results are sent before requesting a new job
  var TOLERANCE_TIME = 10*1000;
  var jobRequestTimer = null;

  // Client-server interaction
  var socket = io.connect();

  var disconnectFromScene = function(sceneID) {
    var clientID = sceneConnections[sceneID].clientID;

    // tell the server that we no longer want to render this scene
    socket.emit('disconnectFromScene', {
      sceneID: sceneID,
      clientID: clientID
    });

    sceneConnections[sceneID] = undefined;
    delete sceneConnections[sceneID];
  };

  var connectToScene = function(sceneID) {
    // get the json representation of the scene we want to connect to,
    // turn it into a ray-traceable scene, then tell the server
    // we want to connect to this scene.
    $.ajax({
      type: 'POST',
      url: '/api/getSceneRenderingData',
      data: {
        sceneID: sceneID
      },
      success: function(res) {
        console.log("CONVERT THAT SHIT");
        console.log(res.scene);
        // Convert res.scene into a Ray Tracer renderable Scene object
        var scene = RayTracer.createRenderableSceneFromJSON(res.scene);
        sceneConnections[sceneID] = { scene: scene };

        socket.emit('connectToScene', {
          acid: Init.getAcid(),
          sceneID: sceneID
        });
      },
      error: function(res) {
        console.log("Error connecting to scene.");
        // TODO: resend request to connect if there is an error
      },
      timeout: 8000
    });
  };

  socket.on('identifier', function(data) {
    var sceneID = data.sceneID;
    var clientID = data.clientID;
    console.log("Client ID: " + clientID + ", for sceneID: " + sceneID);

    // add this client's identifier for this particular scene
    sceneConnections[sceneID].clientID = clientID;

    socket.emit('registeredClient', { clientID: clientID, sceneID: sceneID });
  });

  socket.on('jobAssignment', function(data) {
    clearTimeout(jobRequestTimer);

    var sceneID = data.sceneID;
    var job = data.job;
    var sceneConnection = sceneConnections[sceneID];
    if (!sceneConnection) {
      return;
    }

    var scene = sceneConnection.scene;

    console.log("GOT ASSIGNED A JOB FOR " + sceneID);
    console.log(job);

    var jobID = job.id;
    var startPixelIndex = job.startPixelIndex;
    var endPixelIndex = job.endPixelIndex;
    var results = [];

    sceneConnection.currentJobID = jobID;

    // perform ray trace on given pixels
    var imgWidth = scene.getImage().getWidth();
    for (var i = startPixelIndex; i < endPixelIndex; i++) {
      if (jobID !== sceneConnection.currentJobID) {
        // if at any point we received a new job assignment,
        // stop working on this
        return;
      }
      var p = Util.indexToPixel(i, imgWidth);
      var color = RayTracer.renderPixel(scene, p.x, p.y);
      results.push({
        x: p.x,
        y: p.y,
        r: color.getR(),
        g: color.getG(),
        b: color.getB(),
      });
    }

    socket.emit('jobResult', {
      clientID: sceneConnection.clientID,
      sceneID: sceneID,
      jobID: jobID,
      pixels: results,
    });

    jobRequestTimer = setTimeout(function() {
      socket.emit('jobRequest', {
        clientID: sceneConnection.clientID,
        sceneID: sceneID
      });
    }, TOLERANCE_TIME);
  });

  socket.on('finishedImage', function(data) {
    var sceneID = data.sceneID;

    // update gallery item image
    var galleryItems = Main.getGalleryItems();
    var item = galleryItems.get(sceneID);
    item.set({
      finishedRendering: true,
      thumbnailURL: "../raytraced_images/" + sceneID + ".png"
    });

    if (Main.getCurrentView().id === Router.SCENE) {
      // update selected scene
      Main.getSelectedScene().set({
        finishedRendering: true,
        thumbnailURL: "../raytraced_images/" + sceneID + ".png"
      });
      Main.getCurrentView().render();
    }
    console.log("FINISHED IMAGE");
  });

  // Create the Client object
  return {
    connectToScene: connectToScene,
    disconnectFromScene: disconnectFromScene,
  };

})();
