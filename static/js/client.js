/**
 * Author: Juan Pablo Sarmiento
 * Date: March 2013
 * Description: Client-side ray tracing
 */

/**
 * 1. Client connects to a scene
 * 2. Server sends back a client ID
 * 3. Client tells the server it has been successfully registered
 * 4. Server starts assigning jobs
 * 5. Client renders the pixels, and sends back results
 * 6. Server sends the finished image
 */

Client = (function() {
  var clientID = undefined;

  // Get the scene and prepare it for rendering
  var scene = RayTracer.getSceneToRender();
  scene
    .setImageDimensions(400, 300)
    .setTransform()
    .initializeAABB(); // prepare scene for rendering

  var getScene = function() {
    return scene;
  };

  var getID = function() {
    return clientID;
  };

  // Client-server interaction
  var socket = io.connect();

  var connectToScene = function() {
    socket.emit('connectToScene');
  };

  socket.on('identifier', function(id) {
    clientID = id; 
    console.log(clientID);

    socket.emit('registeredClient', clientID);
  });

  socket.on('jobAssignment', function(job) {
    console.log("GOT ASSIGNED A JOB");
    console.log(job);

    var jobID = job.id;
    var pixels = job.pixels;
    var scene = getScene();
    var results = [];

    // perform ray trace on given pixels
    for (var i = 0; i < pixels.length; i++) {
      var p = pixels[i];
      var color = RayTracer.renderPixel(scene, p.x, p.y)

      results.push({
        x: p.x,
        y: p.y,
        r: color.getR(),
        g: color.getG(),
        b: color.getB(),
      });
    }

    socket.emit('jobResult', {
      clientID: clientID,
      jobID: jobID,
      pixels: results,
    });
  });

  socket.on('finishedImage', function(imageFileName) {
    Main.getView(Router.SCENE).displayFinishedImage(imageFileName);
    console.log("FINISHED IMAGE");
  });

  // Create the Client object
  return {
    connectToScene: connectToScene,
    getID: getID,
  };

})();
