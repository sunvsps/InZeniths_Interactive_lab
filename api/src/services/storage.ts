// Voice notes and photos. The browser uploads and downloads straight from the store through short-lived signed links,
// so files never pass through this server.
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.js';

export type SignedUpload = { url: string; method: 'PUT'; headers: Record<string, string>; expiresIn: number };

export interface Storage {
  signUpload(key: string, contentType: string, bytes: number): Promise<SignedUpload>;
  signDownload(key: string, opts?: { downloadName?: string }): Promise<string>;
  remove(keys: string[]): Promise<void>;
}

const UPLOAD_TTL = 600; // seconds
const DOWNLOAD_TTL = 3600;

export function createStorage(env: Env): Storage {
  if (env.STORAGE_DRIVER === 'memory') return devStorage(`http://localhost:${env.PORT}`);
  const client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  const Bucket = env.R2_BUCKET!;
  return {
    async signUpload(key, contentType, bytes) {
      // Type and size are part of the signature: the browser must send exactly these headers.
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, ContentLength: bytes }), {
        expiresIn: UPLOAD_TTL,
      });
      return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresIn: UPLOAD_TTL };
    },
    async signDownload(key, opts) {
      const disposition = opts?.downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
        : undefined;
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key, ResponseContentDisposition: disposition }), {
        expiresIn: DOWNLOAD_TTL,
      });
    },
    async remove(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
      }
    },
  };
}

/** Dev and tests only: remembers which keys exist, hands out fake links. */
export function memoryStorage(): Storage & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async signUpload(key, contentType) {
      keys.add(key);
      return { url: `memory://upload/${key}`, method: 'PUT', headers: { 'Content-Type': contentType }, expiresIn: UPLOAD_TTL };
    },
    async signDownload(key, opts) {
      return `memory://download/${key}${opts?.downloadName ? `?name=${encodeURIComponent(opts.downloadName)}` : ''}`;
    },
    async remove(list) {
      for (const k of list) keys.delete(k);
    },
  };
}

/**
 * Local development: files are kept in this process and served by the API itself at /v1/dev/files/<key>,
 * so the pages can record, upload and play back a real voice note without R2. Lost on restart; refused in production.
 */
export function devStorage(base: string): Storage & { files: Map<string, { type: string; body: Buffer }> } {
  const files = new Map<string, { type: string; body: Buffer }>();
  const url = (key: string) => `${base}/v1/dev/files/${key}`;
  return {
    files,
    async signUpload(key, contentType) {
      return { url: url(key), method: 'PUT', headers: { 'Content-Type': contentType }, expiresIn: UPLOAD_TTL };
    },
    async signDownload(key, opts) {
      return opts?.downloadName ? `${url(key)}?name=${encodeURIComponent(opts.downloadName)}` : url(key);
    },
    async remove(list) {
      for (const k of list) files.delete(k);
    },
  };
}
