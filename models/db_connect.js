exports = mongoose = require('mongoose');
// MongoDB connection
// var mongo_uri = 'mongodb://localhost/raytracer';
var mongo_uri = 'mongodb://nodejitsu:eadc70cd72250db4d0bbab535dafd6b7@alex.mongohq.com:10018/nodejitsudb7509916564';
mongoose.connect(mongo_uri);

exports = Schema = mongoose.Schema;
