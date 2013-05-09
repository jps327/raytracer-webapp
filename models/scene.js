require('./db_connect');

var SceneSchema = new Schema({
  title: String,
  author: String,
  thumbnailURL: String,
  date: { type: Date, default: Date.now },
  numUsersConnected: { type: Number, min: 0, default: 0 },

  camera: Schema.Types.Mixed, // map of cameraProperty -> value
  lights: [Schema.Types.Mixed], // array of lights
  materials: Schema.Types.Mixed, // map of materialName -> materialProperties
  objects: [Schema.Types.Mixed], // array of objects
  height: Number,
  width: Number,
  startedRendering: Boolean,
  finishedRendering: Boolean,
});

module.exports.Scene = mongoose.model('Scene', SceneSchema);
