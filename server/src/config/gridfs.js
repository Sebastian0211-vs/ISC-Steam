import mongoose from 'mongoose';
import { createReadStream } from 'node:fs';

// One bucket for everything the store serves: packaged game zips and images.
function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'store' });
}

export function uploadFromPath(path, filename, contentType) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { contentType });
    createReadStream(path)
      .pipe(upload)
      .on('error', reject)
      .on('finish', () => resolve(upload.id));
  });
}

export function uploadFromBuffer(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { contentType });
    upload.on('error', reject).on('finish', () => resolve(upload.id));
    upload.end(buffer);
  });
}

export function openDownload(fileId) {
  return bucket().openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

export async function fileInfo(fileId) {
  const files = await bucket()
    .find({ _id: new mongoose.Types.ObjectId(fileId) })
    .toArray();
  return files[0] ?? null;
}

export async function deleteFile(fileId) {
  try {
    await bucket().delete(new mongoose.Types.ObjectId(fileId));
  } catch {
    /* already gone */
  }
}
