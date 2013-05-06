exports = mongoose = require('mongoose');
// MongoDB connection
var mongo_uri = 'mongodb://localhost/raytracer';
mongoose.connect(mongo_uri);

exports = Schema = mongoose.Schema;
