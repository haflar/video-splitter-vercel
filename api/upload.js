import { handleUploadPresigned } from '@vercel/blob/client';
import { issueSignedToken } from '@vercel/blob';
import { isValidPassword } from '../lib/auth.js';
import { jsonBody } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const body = jsonBody(req);

    const result = await handleUploadPresigned({
      body,
      request: req,

      getSignedToken: async (pathname, clientPayload) => {
        let payload = {};
        try {
          payload = JSON.parse(clientPayload || '{}');
        } catch {}

        if (!isValidPassword(payload.password)) {
          throw new Error("Code d'accès incorrect.");
        }

        if (!String(pathname).startsWith('uploads/')) {
          throw new Error('Chemin invalide.');
        }

        const validUntil = Date.now() + 60 * 60 * 1000;

        const token = await issueSignedToken({
          pathname,
          operations: ['put'],
          allowedContentTypes: ['video/*', 'application/octet-stream'],
          maximumSizeInBytes: 20_000_000_000,
          validUntil,
        });

        return {
          token,
          urlOptions: {
            validUntil,
            allowedContentTypes: ['video/*', 'application/octet-stream'],
            maximumSizeInBytes: 20_000_000_000,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ ok: true }),
          },
        };
      },

      onUploadCompleted: async () => {},
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('upload token error', error);
    return res.status(400).json({
      error: error?.message || 'Upload impossible.',
    });
  }
}
