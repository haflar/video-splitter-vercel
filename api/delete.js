import { del } from '@vercel/blob';
import { requirePassword } from '../lib/auth.js';
import { jsonBody, isVercelBlobUrl } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (!requirePassword(req, res)) return;

  try {
    const body = jsonBody(req);
    const urls = Array.isArray(body.urls) ? body.urls.map(String).filter(isVercelBlobUrl).slice(0, 200) : [];
    if (urls.length) await del(urls);
    return res.status(200).json({ ok: true, deleted: urls.length });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Suppression impossible.' });
  }
}
