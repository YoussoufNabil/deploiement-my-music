const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const region = process.env.AWS_REGION || 'us-east-1';
const bucket = process.env.S3_BUCKET || '';
const driver = process.env.STORAGE_DRIVER || (bucket ? 's3' : 'local');
const localRoot = path.resolve(process.env.LOCAL_UPLOAD_DIR || 'storage/uploads');
const s3 = new S3Client({ region });

function safeFilename(originalName) {
  const basename = path.basename(originalName || 'upload.bin');
  return basename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'upload.bin';
}

async function saveFile(file, folder) {
  if (!file || !file.buffer) throw new Error('No file supplied.');
  const key = `${folder}/${randomUUID()}-${safeFilename(file.originalname)}`;

  if (driver === 's3') {
    if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3.');
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
      ServerSideEncryption: 'AES256'
    }));
    return key;
  }

  const destination = path.resolve(localRoot, key);
  if (!destination.startsWith(`${localRoot}${path.sep}`)) {
    throw new Error('Invalid upload path.');
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, file.buffer, { flag: 'wx' });
  return key;
}

async function getFileUrl(key) {
  if (!key) return null;
  if (driver === 's3') {
    if (!bucket) throw new Error('S3_BUCKET is not configured.');
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: Number(process.env.S3_SIGNED_URL_TTL || 300)
    });
  }
  return `/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function deleteFile(key) {
  if (!key) return;
  if (driver === 's3') {
    if (!bucket) return;
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  const destination = path.resolve(localRoot, key);
  if (destination.startsWith(`${localRoot}${path.sep}`)) {
    await fs.rm(destination, { force: true });
  }
}

module.exports = { saveFile, getFileUrl, deleteFile, storageDriver: driver, localRoot };
