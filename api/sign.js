import { requirePassword } from '../lib/auth.js';
import { jsonBody, isVercelBlobUrl } from '../lib/http.js';
import { signedGetUrl } from '../lib/blob-sign.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (!requirePassword(req, res)) return;

  try {
    const body = jsonBody(req);
    const urls = Array.isArray(body.urls)
      ? body.urls.map(String).filter(isVercelBlobUrl).slice(0, 200)
      : [];

    const items = await Promise.all(urls.map(async url => ({
      url,
      downloadUrl: await signedGetUrl(url)
    })));

    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Lien de téléchargement impossible.' });
  }
}
