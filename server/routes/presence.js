'use strict';

const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const { requireAuth, requirePerm } = require('../middleware/auth');
const presence = require('../services/presence');

router.use(requireAuth, requirePerm('view.presence'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const range = req.query.range === 'month' ? 'month' : 'week';
    res.json(await presence.buildPresence({ range, offset: req.query.offset }));
  })
);

module.exports = router;
