'use strict';

const { EventEmitter } = require('events');

class Bus extends EventEmitter {}

const bus = new Bus();
bus.setMaxListeners(100);

module.exports = bus;
