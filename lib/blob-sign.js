import { issueSignedToken, presignUrl } from '@vercel/blob';

export function pathnameFromBlobUrl(value) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.vercel-storage.com')) {
    throw new Error('URL Blob invalide.');
  }
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}

export async function signedGetUrl(urlOrPathname, ttlMs = 6 * 60 * 60 * 1000) {
  const pathname = String(urlOrPathname).startsWith('https://')
    ? pathnameFromBlobUrl(urlOrPathname)
    : String(urlOrPathname).replace(/^\//, '');

  const token = await issueSignedToken({ operations: ['get'] });
  const { presignedUrl } = await presignUrl(token, {
    pathname,
    operation: 'get',
    validUntil: Date.now() + ttlMs,
    useCache: false
  });
  return presignedUrl;
}
