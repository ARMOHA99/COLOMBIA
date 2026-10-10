'use strict';

const mongoose = require('mongoose');

module.exports = {
  User: require('./User'),
  Product: require('./Product'),
  Order: require('./Order'),
  Operation: require('./Operation'),
  OperationType: require('./OperationType'),
  WeeklyTarget: require('./WeeklyTarget'),
  Announcement: require('./Announcement'),
  FarmPlot: require('./FarmPlot'),
  HarvestLog: require('./HarvestLog'),
  TreasuryEntry: require('./TreasuryEntry'),
  DutySession: require('./DutySession'),
  Discipline: require('./Discipline'),
  Ticket: require('./Ticket'),
  InternalItem: require('./InternalItem'),
  InternalPurchase: require('./InternalPurchase'),
  AuditLog: require('./AuditLog'),
  Settings: require('./Settings'),
  mongoose
};
