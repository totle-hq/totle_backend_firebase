// services/s3Service.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.NUCLEUS_DOCS_BUCKET;

/**
 * Generate a presigned URL for uploading to S3
 */
export async function getUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
}

/**
 * Generate a presigned URL for downloading from S3
 * @param {string} key - the object key in the bucket
 * @param {number} expiresIn - expiry time in seconds (default 300 = 5 min)
 */
export async function getDownloadUrl(key, expiresIn = 300) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}
