import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o/1/l, easy to read aloud

/** Random id from an unambiguous alphabet. 12 chars = 60 bits, too many to guess. */
export function randomSlug(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export const randomToken = () => randomBytes(24).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function sameHash(token: string, hash: string): boolean {
  const a = Buffer.from(sha256(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
