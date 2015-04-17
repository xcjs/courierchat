'use strict';

var Q = require('q');
var RoomFactory = require('./RoomFactory.js');

module.exports = function() {
    var self = this;

    this.enterRoom = function(roomName) {
        return RoomFactory.findByName(roomName);
    };

    this.leaveRoom = function(roomName) {

    };

    this.deleteRoom = function(roomName) {

    };
};
