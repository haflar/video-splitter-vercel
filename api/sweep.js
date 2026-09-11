import { list, del } from '@vercel/blob';
import { requirePassword } from '../lib/auth.js';

async function sweepPrefix(prefix, maxAgeMs) {
  let cursor;
  let deleted = 0;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    const cutoff = Date.now() - maxAgeMs;
    const old = page.blobs.filter(blob => new Date(blob.uploadedAt).getTime() < cutoff).map(blob => blob.url);
    if (old.length) {
      await del(old);
      deleted += old.length;
    }
    cursor = page.cursor;
  } while (cursor);
  return deleted;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (!requirePassword(req, res)) return;

  try {
    const outputs = await sweepPrefix('parts/', 24 * 60 * 60 * 1000);
    const uploads = await sweepPrefix('uploads/', 6 * 60 * 60 * 1000);
    return res.status(200).json({ ok: true, deleted: outputs + uploads });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Nettoyage impossible.' });
  }
}
