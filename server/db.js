'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongo.uri, { autoIndex: true });
  return mongoose.connection;
}

module.exports = { connectDB };
