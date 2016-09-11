'use strict';

var Waterline = require('waterline');

var message = require('../models/message.js');
var room = require('../models/room.js');
var user = require('../models/user.js');

var orm = new Waterline();

orm.loadCollection(message);
orm.loadCollection(room);
orm.loadCollection(user);

module.exports = orm;
