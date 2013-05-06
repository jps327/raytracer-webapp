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

  // Client-server interaction
  var socket = io.connect();

  var connectToScene = function(sceneID) {
    // get the json representation of the scene we want to connect to,
    // turn it into a ray-traceable scene, then tell the server
    // we want to connect to this scene.
    $.ajax({
      type: 'POST',
      url: '/api/getScene',
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
    var sceneID = data.sceneID;
    var job = data.job;
    var scene = sceneConnections[sceneID].scene;

    console.log("GOT ASSIGNED A JOB FOR " + sceneID);
    console.log(job);

    var jobID = job.id;
    var pixels = job.pixels;
    var results = [];

    // perform ray trace on given pixels
    for (var i = 0; i < pixels.length; i++) {
      var p = pixels[i];
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
      clientID: sceneConnections[sceneID].clientID,
      sceneID: sceneID,
      jobID: jobID,
      pixels: results,
    });
  });

  socket.on('finishedImage', function(imageFileName) {
    // TODO: display the finished image correctly
    Main.getView(Router.SCENE).displayFinishedImage(imageFileName);
    console.log("FINISHED IMAGE");
  });

  // Create the Client object
  return {
    connectToScene: connectToScene
  };

})();
