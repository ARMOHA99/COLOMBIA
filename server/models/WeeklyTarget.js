'use strict';

const mongoose = require('mongoose');

const weeklyTargetSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ['current', 'archived'], default: 'current', index: true },
    weekKey: { type: String, required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    goal: { type: Number, default: 20, min: 0 },
    score: { type: Number, default: 0, min: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

weeklyTargetSchema.index({ scope: 1, weekKey: 1 }, { unique: true });

module.exports = mongoose.models.WeeklyTarget || mongoose.model('WeeklyTarget', weeklyTargetSchema);
