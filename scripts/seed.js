'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = require('../config/env');
const site = require('../config/site');
const mongoose = require('mongoose');
const { connectDB } = require('../server/db');
const {
  Settings,
  OperationType,
  Product,
  InternalItem,
  WeeklyTarget,
  FarmPlot,
  Announcement
} = require('../server/models');
const targetSvc = require('../server/services/target');
const logger = require('../server/services/logger');

const SAMPLE_PRODUCTS = [
  {
    name: 'بندقية AK-47',
    description: 'سلاح افتراضي داخل اللعبة — يُسلَّم عبر المتجر',
    category: 'أسلحة',
    price: 2500,
    stock: 10,
    sortOrder: 1
  },
  {
    name: 'سترة واقية من الرصاص',
    description: 'درع داخلي افتراضي يرفع نسبة الصمود',
    category: 'أدوات',
    price: 1200,
    stock: 25,
    sortOrder: 2
  },
  {
    name: 'سيارة سيدان فاخرة',
    description: 'مركبة افتراضية تُسلَّم عند نقطة التسليم',
    category: 'مركبات',
    price: 15000,
    stock: 2,
    sortOrder: 3
  },
  {
    name: 'هاتف ذكي',
    description: 'أداة اتصال داخلية للاستخدام في اللعبة',
    category: 'أدوات',
    price: 800,
    stock: 15,
    sortOrder: 4
  },
  {
    name: 'قبعة المنظمة',
    description: 'ملابس رمزية للأعضاء',
    category: 'ملابس',
    price: 300,
    stock: 40,
    sortOrder: 5
  },
  {
    name: 'حبوب البن',
    description: 'محصول المزرعة — يُضاف تلقائياً بعد الحصاد',
    category: 'أخرى',
    price: 500,
    stock: 0,
    farmProduced: true,
    sortOrder: 6
  },
  {
    name: 'حبوب الكاكاو',
    description: 'محصول المزرعة — يُضاف تلقائياً بعد الحصاد',
    category: 'أخرى',
    price: 650,
    stock: 0,
    farmProduced: true,
    sortOrder: 7
  },
  {
    name: 'القطن',
    description: 'محصول المزرعة — يُضاف تلقائياً بعد الحصاد',
    category: 'أخرى',
    price: 400,
    stock: 0,
    farmProduced: true,
    sortOrder: 8
  }
];

const INTERNAL_ITEMS = [
  { name: 'علبة ذخيرة (100)', description: 'ذخيرة افتراضية من متجر الأعضاء', price: 500, stock: 30, sortOrder: 1 },
  { name: 'جهاز اتصال داخلي', description: 'قناة اتصال خاصة داخل المنظمة', price: 300, stock: 20, sortOrder: 2 },
  { name: 'قسيمة إصلاح', description: 'إصلاح مجاني لمركبة واحدة', price: 250, stock: 15, sortOrder: 3 }
];

async function seed() {
  await connectDB();
  logger.info('connected — seeding...');

  await Settings.getInstance();
  logger.info('settings ensured');

  for (const [i, t] of site.defaults.operationTypes.entries()) {
    await OperationType.findOneAndUpdate(
      { key: t.key },
      { $setOnInsert: { key: t.key, label: t.label, color: t.color, active: true, sortOrder: i } },
      { upsert: true }
    );
  }
  logger.info(`operation types: ${site.defaults.operationTypes.length}`);

  for (const p of SAMPLE_PRODUCTS) {
    await Product.findOneAndUpdate({ name: p.name }, { $setOnInsert: { ...p, active: true } }, { upsert: true });
  }
  logger.info('sample products ensured');

  for (const item of INTERNAL_ITEMS) {
    await InternalItem.findOneAndUpdate({ name: item.name }, { $setOnInsert: { ...item, active: true } }, { upsert: true });
  }
  logger.info('internal items ensured');

  await targetSvc.getCurrentTarget({ allowRollover: true });
  logger.info('weekly target ensured');

  const plotCount = (await Settings.getInstance()).plotsCount;
  const existingPlots = await FarmPlot.countDocuments();
  if (existingPlots < plotCount) {
    const docs = [];
    for (let n = existingPlots + 1; n <= plotCount; n += 1) docs.push({ plotNumber: n, status: 'empty' });
    await FarmPlot.insertMany(docs, { ordered: false }).catch(() => {});
  }
  logger.info(`farm plots ensured (${plotCount})`);

  await Announcement.findOneAndUpdate(
    { title: 'أهلاً بكم في البوابة' },
    {
      $setOnInsert: {
        title: 'أهلاً بكم في البوابة',
        body: 'هذه هي البوابة الرسمية للمنظمة. تابعوا الهدف الأسبوعي وسجل العمليات، ودوامكم اليومي شرف لنا.',
        pinned: true
      }
    },
    { upsert: true }
  );
  logger.info('welcome announcement ensured');

  const counts = {
    products: await Product.countDocuments(),
    internalItems: await InternalItem.countDocuments(),
    operationTypes: await OperationType.countDocuments(),
    plots: await FarmPlot.countDocuments(),
    settings: await Settings.countDocuments(),
    targets: await WeeklyTarget.countDocuments()
  };
  logger.info('seed complete:', JSON.stringify(counts));
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  logger.error('seed failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
