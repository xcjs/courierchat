'use strict';

var Q = require('q');

module.exports = {
    findByName: function(roomName) {
        var deferred = Q.defer();

        if (roomName === null || roomName === undefined) {
            deferred.reject('What are we supposed to name the room?');
            return deferred.promise;
        }

        Room.findOne({name: roomName}).exec(function(err, room) {
            if (room) {
                deferred.reject('Sorry, that room name already in use.');
                return;
            }
            if (err) {
                deferred.reject(err);
                return;
            }

            Room.create({name: roomName}).exec(function(err, room) {
                if (err) {
                    deferred.reject(err);
                }
                deferred.resolve(room);
            });
        });
        return deferred.promise;
    }
};
