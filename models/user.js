require('./db_connect');

var UserSchema = new Schema({
  username: String,
  acid: String,
  createdAt: {type: Date, default: Date.now},
  fb: {
    accessToken: String,
    expires: Date,
    name: {
      full: String,
      first: String,
      last: String,
    },
    gender: String,
    email: String,
    timezone: String,
    updatedTime: String,
    userID: String
  },
});

module.exports.User = mongoose.model('User', UserSchema);
