const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const { query } = require('../config/db');
const { ApiError } = require('./http');
const { detectFileType } = require('../middleware/common');

fs.mkdirSync(env.upload.dir, { recursive: true });

/**
 * Validate uploaded buffers by their real file signature, then return metadata.
 * Throws before anything is written if any file is not an allowed type.
 */
function inspect(files = []) {
  return files.map((f) => {
    const type = detectFileType(f.buffer);
    if (!type) throw ApiError.badRequest(`"${f.originalname}" is not a valid JPG, PNG, WEBP or PDF file.`);
    const storedName = `${crypto.randomUUID()}.${type.ext}`; // never derived from user input
    const safeOriginal = path.basename(f.originalname).replace(/[^\w.\- ()]/g, '_').slice(0, 200) || `evidence.${type.ext}`;
    return { file: f, type, storedName, safeOriginal };
  });
}

/** Write files to private storage (outside any public/static folder) and record them. */
async function save(inspected, reportId, userId, conn) {
  const written = [];
  try {
    for (const item of inspected) {
      const target = path.join(env.upload.dir, item.storedName);
      await fs.promises.writeFile(target, item.file.buffer, { flag: 'wx', mode: 0o600 });
      written.push(target);
      await query(
        `INSERT INTO driver_report_evidence (report_id, stored_name, original_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [reportId, item.storedName, item.safeOriginal, item.type.mime, item.file.size, userId], conn
      );
    }
  } catch (err) {
    await removeFiles(written);
    throw err;
  }
  return written;
}

async function removeFiles(paths) {
  await Promise.all(paths.map((p) => fs.promises.unlink(p).catch(() => {})));
}

/** Stream a stored file as a download with safe headers. */
function send(res, row) {
  const filePath = path.join(env.upload.dir, path.basename(row.stored_name));
  if (!fs.existsSync(filePath)) throw ApiError.notFound('Evidence file is missing from storage.');
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  const inline = row.mime_type.startsWith('image/') ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${inline}; filename="${row.original_name.replace(/"/g, '')}"`);
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { inspect, save, send, removeFiles };
