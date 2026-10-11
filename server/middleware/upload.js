'use strict';

const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const env = require('../../config/env');
const site = require('../../config/site');

if (env.cloudinary.configured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true
  });
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.security.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      const err = new Error(site.strings.errors.uploadType);
      err.status = 400;
      err.code = 'UPLOAD_TYPE';
      return cb(err);
    }
    return cb(null, true);
  }
});

function uploadBuffer(buffer, folder = 'colombia') {
  return new Promise((resolve, reject) => {
    if (!env.cloudinary.configured) {
      const err = new Error('Cloudinary is not configured');
      err.status = 503;
      err.code = 'CLOUDINARY_OFF';
      return reject(err);
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ quality: 'auto:good', fetch_format: 'auto' }] },
      (error, result) => {
        if (error) {
          const err = new Error(site.strings.errors.server);
          err.status = 502;
          err.code = 'UPLOAD_FAILED';
          return reject(err);
        }
        return resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { upload, uploadBuffer, cloudinaryConfigured: env.cloudinary.configured };
