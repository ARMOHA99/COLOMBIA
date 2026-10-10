'use strict';

const mongoose = require('mongoose');
const site = require('../../config/site');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'site', unique: true },
    siteName: { type: String, default: site.org.nameAr },
    siteTagline: { type: String, default: site.org.tagline },
    logoUrl: { type: String, default: '' },
    motd: { type: String, default: site.org.motd },
    weeklyGoal: { type: Number, default: site.defaults.weeklyGoal, min: 0 },
    lockoutEnabled: { type: Boolean, default: site.defaults.lockoutEnabled },
    lockoutStart: { type: String, default: site.defaults.lockoutStart },
    lockoutEnd: { type: String, default: site.defaults.lockoutEnd },
    plotsCount: { type: Number, default: 6, min: 1, max: 48 },
    crops: { type: [mongoose.Schema.Types.Mixed], default: () => site.defaults.crops.map((c) => ({ ...c })) },
    treasuryCategories: { type: [String], default: () => [...site.defaults.treasuryCategories] },
    categories: { type: [String], default: () => [...site.defaults.categories] },
    shopNotice: { type: String, default: '' },
    maintenance: { type: Boolean, default: false }
  },
  { timestamps: true }
);

settingsSchema.statics.getInstance = async function getInstance() {
  let doc = await this.findOne({ key: 'site' });
  if (!doc) {
    doc = await this.findOneAndUpdate({ key: 'site' }, { $setOnInsert: { key: 'site' } }, { upsert: true, new: true });
  }
  return doc;
};

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
