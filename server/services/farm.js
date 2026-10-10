'use strict';

const { FarmPlot, Product, HarvestLog, Settings } = require('../models');
const bus = require('./bus');
const logger = require('./logger');
const { logAudit } = require('./audit');

async function ensurePlots() {
  const settings = await Settings.getInstance();
  const count = settings.plotsCount || 6;
  const existing = await FarmPlot.countDocuments();
  if (existing < count) {
    const docs = [];
    for (let n = existing + 1; n <= count; n += 1) docs.push({ plotNumber: n, status: 'empty' });
    if (docs.length) await FarmPlot.insertMany(docs, { ordered: false }).catch(() => {});
  } else if (existing > count) {
    const empties = await FarmPlot.find({ status: 'empty' }).sort({ plotNumber: -1 }).limit(existing - count);
    if (empties.length) await FarmPlot.deleteMany({ _id: { $in: empties.map((p) => p._id) } });
  }
  return FarmPlot.find().sort({ plotNumber: 1 });
}

async function plant(plot, cropKey, user) {
  const settings = await Settings.getInstance();
  const crop = (settings.crops || []).find((c) => c.key === cropKey);
  if (!crop) throw Object.assign(new Error('crop'), { status: 400, code: 'CROP' });
  if (plot.status !== 'empty') throw Object.assign(new Error('busy'), { status: 409, code: 'BUSY' });
  const now = new Date();
  plot.status = 'planted';
  plot.crop = {
    key: crop.key,
    label: crop.label,
    targetProduct: crop.targetProduct,
    growMs: crop.growMs,
    minQty: crop.minQty,
    maxQty: crop.maxQty
  };
  plot.plantedAt = now;
  plot.readyAt = new Date(now.getTime() + (crop.growMs || 30 * 60 * 1000));
  plot.plantedBy = user ? user._id : null;
  await plot.save();
  bus.emit('notify', { room: 'scope:members', event: 'farm:updated', data: { plot: plot.plotNumber, status: plot.status } });
  return plot;
}

async function harvest(plot, user) {
  if (plot.status !== 'ready') throw Object.assign(new Error('not ready'), { status: 409, code: 'NOT_READY' });
  const crop = plot.crop || {};
  const min = crop.minQty || 1;
  const max = Math.max(min, crop.maxQty || min);
  const qty = min + Math.floor(Math.random() * (max - min + 1));

  let product = null;
  if (crop.targetProduct) {
    product = await Product.findOne({ name: crop.targetProduct });
    if (!product) {
      product = await Product.create({
        name: crop.targetProduct,
        category: 'أخرى',
        price: 500,
        stock: 0,
        farmProduced: true,
        active: true
      });
    }
    product.stock = (product.stock || 0) + qty;
    await product.save();
  }

  const logDoc = await HarvestLog.create({
    plotNumber: plot.plotNumber,
    cropLabel: crop.label || '',
    productName: crop.targetProduct || '',
    qty,
    stockAfter: product ? product.stock : 0,
    user: user ? user._id : null
  });

  plot.status = 'empty';
  plot.crop = undefined;
  plot.plantedAt = null;
  plot.readyAt = null;
  plot.harvestedBy = user ? user._id : null;
  plot.lastYield = qty;
  await plot.save();

  bus.emit('notify', {
    room: 'scope:members',
    event: 'farm:harvested',
    data: { plot: plot.plotNumber, qty, product: crop.targetProduct, stock: product ? product.stock : null }
  });
  if (product) {
    bus.emit('notify', {
      room: 'scope:members',
      event: 'shop:stock',
      data: { productId: String(product._id), stock: product.stock }
    });
  }
  return { plot, logDoc, qty };
}

async function checkReadiness() {
  const now = new Date();
  const due = await FarmPlot.find({ status: 'planted', readyAt: { $lte: now } });
  for (const plot of due) {
    plot.status = 'ready';
    await plot.save();
    bus.emit('notify', {
      room: 'scope:members',
      event: 'farm:ready',
      data: { plot: plot.plotNumber, crop: plot.crop ? plot.crop.label : '' }
    });
    logger.info(`plot #${plot.plotNumber} is ready`);
  }
  return due.length;
}

async function clearPlot(plot, user) {
  if (plot.status === 'planted' || plot.status === 'ready') {
    plot.status = 'empty';
    plot.crop = undefined;
    plot.plantedAt = null;
    plot.readyAt = null;
    await plot.save();
    await logAudit({
      actor: user,
      action: 'farm.clear',
      targetType: 'plot',
      targetId: plot.plotNumber
    });
    bus.emit('notify', { room: 'scope:members', event: 'farm:updated', data: { plot: plot.plotNumber, status: 'empty' } });
  }
  return plot;
}

module.exports = { ensurePlots, plant, harvest, checkReadiness, clearPlot };
