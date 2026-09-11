import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import ffmpegPath from 'ffmpeg-static';
import { put } from '@vercel/blob';
import { signedGetUrl } from '../lib/blob-sign.js';
import { requirePassword } from '../lib/auth.js';
import { jsonBody, isVercelBlobUrl } from '../lib/http.js';

const MAX_BYTES = 120_000_000;
const TARGET_BYTES = 108_000_000;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-6000) || `FFmpeg a quitté avec le code ${code}.`));
    });
  });
}

async function makePart(url, start, duration, outPath) {
  await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(start),
    '-i', url,
    '-t', String(duration),
    '-map', '0:v:0?', '-map', '0:a:0?',
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    '-movflags', '+faststart',
    outPath
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (!requirePassword(req, res)) return;

  const tempFiles = [];
  try {
    const body = jsonBody(req);
    const url = String(body.url || '');
    const jobId = String(body.jobId || '');
    const partNumber = Number(body.partNumber || 0);
    const start = Number(body.start || 0);
    let duration = Number(body.duration || 0);

    if (!isVercelBlobUrl(url)) throw new Error('URL vidéo invalide.');
    if (!/^[a-f0-9-]{20,60}$/i.test(jobId)) throw new Error('Identifiant invalide.');
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 9999) throw new Error('Numéro de partie invalide.');
    if (!Number.isFinite(start) || start < 0) throw new Error('Début invalide.');
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Durée invalide.');

    duration = Math.min(duration, 7200);
    const sourceUrl = await signedGetUrl(url, 30 * 60 * 1000);

    let finalPath = null;
    let finalSize = 0;
    let usedDuration = duration;

    for (let attempt = 0; attempt < 5; attempt++) {
      const tempPath = path.join(os.tmpdir(), `v120-${crypto.randomUUID()}.mp4`);
      tempFiles.push(tempPath);
      await makePart(sourceUrl, start, usedDuration, tempPath);
      const stat = await fsp.stat(tempPath);
      finalSize = stat.size;

      if (finalSize <= MAX_BYTES) {
        finalPath = tempPath;
        break;
      }

      await fsp.rm(tempPath, { force: true });
      const shrink = Math.min(0.92, (TARGET_BYTES / finalSize) * 0.95);
      usedDuration = Math.max(0.35, usedDuration * shrink);
    }

    if (!finalPath) throw new Error('Impossible de produire une partie sous 120 Mo.');

    const name = `part_${String(partNumber).padStart(3, '0')}.mp4`;
    const stream = Readable.toWeb(fs.createReadStream(finalPath));
    const blob = await put(`parts/${jobId}/${name}`, stream, {
      access: 'private',
      contentType: 'video/mp4',
      addRandomSuffix: false,
      multipart: finalSize > 100_000_000,
      cacheControlMaxAge: 60
    });

    const downloadUrl = await signedGetUrl(blob.url);

    return res.status(200).json({
      name,
      url: blob.url,
      downloadUrl,
      size: finalSize,
      durationUsed: usedDuration,
      maxBytes: MAX_BYTES
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Découpage impossible.' });
  } finally {
    await Promise.all(tempFiles.map(file => fsp.rm(file, { force: true }).catch(() => {})));
  }
}
