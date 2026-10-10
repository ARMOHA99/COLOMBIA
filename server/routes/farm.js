'use strict';

const router = require('express').Router();
const { FarmPlot, HarvestLog, Settings } = require('../models');
const farmSvc = require('../services/farm');
const rolesSvc = require('../services/roles');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

function serializePlot(plot) {
  return {
    id: String(plot._id),
    plotNumber: plot.plotNumber,
    status: plot.status,
    crop: plot.status === 'empty' ? null : plot.crop,
    plantedAt: plot.plantedAt,
    readyAt: plot.readyAt,
    lastYield: plot.lastYield,
    remainingMs: plot.readyAt ? Math.max(0, new Date(plot.readyAt).getTime() - Date.now()) : 0
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [plots, logs, settings] = await Promise.all([
      FarmPlot.find().sort({ plotNumber: 1 }),
      HarvestLog.find().sort({ at: -1 }).limit(15).populate('user', 'globalName username avatar'),
      Settings.getInstance()
    ]);
    res.json({
      plots: plots.map(serializePlot),
      crops: settings.crops || [],
      logs: logs.map((l) => ({
        id: String(l._id),
        plotNumber: l.plotNumber,
        cropLabel: l.cropLabel,
        productName: l.productName,
        qty: l.qty,
        stockAfter: l.stockAfter,
        user: l.user ? { id: String(l.user._id), name: l.user.displayName(), avatar: l.user.avatarUrl(64) } : null,
        at: l.at
      })),
      canManage: rolesSvc.rankValue(req.user.rank) >= 3
    });
  })
);

router.post(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const plot = await FarmPlot.findById(req.params.id);
    if (!plot) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    try {
      await farmSvc.plant(plot, String((req.body || {}).cropKey || ''), req.user);
    } catch (err) {
      if (err.code === 'CROP') throw fail(400, site.strings.errors.validation, 'VALIDATION');
      if (err.code === 'BUSY') throw fail(409, 'البقعة مشغولة حالياً', 'BUSY');
      throw err;
    }
    const fresh = await FarmPlot.findById(plot._id);
    res.json({ plot: serializePlot(fresh) });
  })
);

router.post(
  '/:id/harvest',
  asyncHandler(async (req, res) => {
    const plot = await FarmPlot.findById(req.params.id);
    if (!plot) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    try {
      const result = await farmSvc.harvest(plot, req.user);
      res.json({
        plot: serializePlot(result.plot),
        yield: { qty: result.qty, product: result.logDoc.productName }
      });
    } catch (err) {
      if (err.code === 'NOT_READY') throw fail(409, 'المحصول غير جاهز بعد', 'NOT_READY');
      throw err;
    }
  })
);

router.post(
  '/:id/clear',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const plot = await FarmPlot.findById(req.params.id);
    if (!plot) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    await farmSvc.clearPlot(plot, req.user);
    const fresh = await FarmPlot.findById(plot._id);
    res.json({ plot: serializePlot(fresh) });
  })
);

module.exports = router;
