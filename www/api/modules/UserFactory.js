'use strict';

var Q = require('q');

module.exports = {
  findByName: function(name) {
    var deferred = Q.defer();

    if(name === null || name === undefined) {
      deferred.reject('What are we supposed to name you?');
      return deferred.promise;
    }

    User.findOne({ name: name }).exec(function(err, user) {
      if(user) {
        deferred.reject('You can\'t take a name already in use.');
        return;
      }
      if(err) {
        deferred.reject(err);
        return;
      }

      User.create({ name: name }).exec(function(err, user) {
        if(err) {
          deferred.reject(err);
        }
        deferred.resolve(user);
      });
    });

    return deferred.promise;
  }
};
