import { uploadPresigned } from '@vercel/blob/client';
import './style.css';

const MAX_BYTES = 120_000_000;
const TARGET_BYTES = 108_000_000;
const app = document.querySelector('#app');

let password = sessionStorage.getItem('v120-password') || '';
let selectedFile = null;
let duration = 0;
let outputUrls = [];

const fmtMB = bytes => `${(bytes / 1_000_000).toFixed(1)} Mo`;
const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function renderLocked(message = '') {
  app.innerHTML = `
    <section class="shell">
      <div class="brand">120</div>
      <h1>Split 120</h1>
      <p class="lead">Découpe une vidéo en fichiers de 120 Mo maximum.</p>
      <div class="card">
        <label for="password">Code d'accès</label>
        <input id="password" type="password" autocomplete="current-password" placeholder="Entre le code" value="${escapeHtml(password)}" />
        <button id="unlock">Ouvrir l'application</button>
        ${message ? `<p class="error">${escapeHtml(message)}</p>` : ''}
      </div>
    </section>`;
  document.querySelector('#unlock').onclick = unlock;
  document.querySelector('#password').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
}

async function unlock(valueOverride) {
  const field = document.querySelector('#password');
  const value = (typeof valueOverride === 'string' ? valueOverride : (field?.value || '')).trim();
  const button = document.querySelector('#unlock');
  if (button) { button.disabled = true; button.textContent = 'Vérification…'; }
  try {
    const res = await fetch('/api/sweep', { method: 'POST', headers: { 'x-app-password': value } });
    if (!res.ok) throw new Error('Code incorrect.');
    password = value;
    sessionStorage.setItem('v120-password', password);
    renderMain();
  } catch (e) {
    renderLocked(e.message || 'Impossible de se connecter.');
  }
}

function renderMain() {
  app.innerHTML = `
    <section class="shell">
      <header class="top">
        <div><div class="eyebrow">APPLICATION MOBILE</div><h1>Split 120</h1></div>
        <button id="lock" class="ghost small">Verrouiller</button>
      </header>
      <p class="lead">Choisis une vidéo. Elle sera découpée en plusieurs MP4 de <strong>120 Mo maximum</strong>.</p>
      <div class="card">
        <label class="picker" for="video">
          <span class="pickerIcon">＋</span>
          <span><b>Choisir une vidéo</b><small>Galerie ou fichiers du téléphone</small></span>
        </label>
        <input id="video" type="file" accept="video/*" hidden />
        <div id="fileInfo"></div>
        <button id="start" disabled>Découper la vidéo</button>
        <div id="status"></div>
      </div>
      <div id="results"></div>
      <p class="privacy">La vidéo source est supprimée du cloud après le découpage. Les morceaux restent disponibles jusqu'à leur suppression depuis cette page; un nettoyage automatique est aussi fait lors des prochaines ouvertures.</p>
    </section>`;

  document.querySelector('#lock').onclick = () => { sessionStorage.removeItem('v120-password'); password = ''; renderLocked(); };
  document.querySelector('#video').onchange = onFile;
  document.querySelector('#start').onclick = startSplit;
}

async function videoDuration(file) {
  return await new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const value = Number(video.duration);
      URL.revokeObjectURL(url);
      if (Number.isFinite(value) && value > 0) resolve(value);
      else reject(new Error('Durée vidéo illisible.'));
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Format vidéo non reconnu par le téléphone.')); };
    video.src = url;
  });
}

async function onFile(event) {
  selectedFile = event.target.files?.[0] || null;
  const info = document.querySelector('#fileInfo');
  const start = document.querySelector('#start');
  outputUrls = [];
  document.querySelector('#results').innerHTML = '';
  if (!selectedFile) { info.innerHTML = ''; start.disabled = true; return; }

  info.innerHTML = `<div class="fileRow"><div><b>${escapeHtml(selectedFile.name)}</b><small>${fmtMB(selectedFile.size)}</small></div><span class="spinner"></span></div>`;
  try {
    duration = await videoDuration(selectedFile);
    const estimated = Math.max(1, Math.ceil(selectedFile.size / TARGET_BYTES));
    info.innerHTML = `<div class="fileRow"><div><b>${escapeHtml(selectedFile.name)}</b><small>${fmtMB(selectedFile.size)} · ${Math.round(duration)} s · environ ${estimated} partie${estimated > 1 ? 's' : ''}</small></div><span class="ok">✓</span></div>`;
    start.disabled = false;
  } catch (e) {
    info.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
    start.disabled = true;
  }
}

function setStatus(html) { document.querySelector('#status').innerHTML = html; }

async function authedPost(path, data) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-password': password },
    body: JSON.stringify(data)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'Erreur serveur.');
  return payload;
}

async function startSplit() {
  if (!selectedFile) return;
  const button = document.querySelector('#start');
  button.disabled = true;
  outputUrls = [];
  document.querySelector('#results').innerHTML = '';

  try {
    setStatus(`<div class="progressText"><b>Envoi de la vidéo…</b><span id="pct">0%</span></div><div class="bar"><i id="bar"></i></div>`);
    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const source = await uploadPresigned(`uploads/${Date.now()}-${safeName}`, selectedFile, {
      access: 'private',
      handleUploadUrl: '/api/upload',
      clientPayload: JSON.stringify({ password }),
      multipart: selectedFile.size > 100_000_000,
      contentType: selectedFile.type || 'application/octet-stream',
      onUploadProgress: p => {
        const pct = Math.round(p.percentage || 0);
        document.querySelector('#pct').textContent = `${pct}%`;
        document.querySelector('#bar').style.width = `${pct}%`;
      }
    });

    if (selectedFile.size <= MAX_BYTES) {
      outputUrls = [source.url];
      const signed = await authedPost('/api/sign', { urls: [source.url] });
      renderResults([{ name: selectedFile.name, url: source.url, downloadUrl: signed.items[0].downloadUrl, size: selectedFile.size }], true);
      setStatus('<p class="success">La vidéo faisait déjà moins de 120 Mo.</p>');
      return;
    }

    const jobId = crypto.randomUUID();
    let start = 0;
    let partNumber = 1;
    let desiredDuration = Math.max(0.5, duration * (TARGET_BYTES / selectedFile.size));
    const parts = [];

    while (start < duration - 0.08 && partNumber <= 9999) {
      const remaining = Math.max(0.1, duration - start);
      const requested = Math.min(desiredDuration, remaining);
      const approxTotal = Math.max(partNumber, Math.ceil((duration - start) / Math.max(requested, 0.1)) + partNumber - 1);
      setStatus(`<div class="progressText"><b>Découpage… partie ${partNumber}</b><span>${Math.round((start / duration) * 100)}%</span></div><div class="bar"><i style="width:${Math.max(2, (start / duration) * 100)}%"></i></div><small>Environ ${approxTotal} parties au total</small>`);

      const part = await authedPost('/api/part', {
        url: source.url,
        jobId,
        partNumber,
        start,
        duration: requested
      });
      parts.push(part);
      outputUrls.push(part.url);
      start += Math.max(0.05, Number(part.durationUsed));
      desiredDuration = Math.max(0.5, Number(part.durationUsed));
      partNumber += 1;
    }

    await authedPost('/api/delete', { urls: [source.url] }).catch(() => {});
    setStatus('<p class="success">Découpage terminé.</p>');
    renderResults(parts, false);
  } catch (e) {
    setStatus(`<p class="error">${escapeHtml(e.message || 'Erreur pendant le découpage.')}</p>`);
  } finally {
    button.disabled = false;
  }
}

function renderResults(parts, keepSource) {
  const results = document.querySelector('#results');
  results.innerHTML = `
    <section class="card resultsCard">
      <h2>${parts.length} fichier${parts.length > 1 ? 's' : ''}</h2>
      <div class="parts">
        ${parts.map((part, i) => `
          <a class="part" href="${escapeHtml(part.downloadUrl || part.url)}" download="${escapeHtml(part.name || `part_${i + 1}.mp4`)}">
            <span><b>${escapeHtml(part.name || `Partie ${i + 1}`)}</b><small>${fmtMB(part.size || 0)}</small></span><strong>↓</strong>
          </a>`).join('')}
      </div>
      <button id="cleanup" class="danger">Supprimer ces fichiers du cloud</button>
    </section>`;

  document.querySelector('#cleanup').onclick = async () => {
    const btn = document.querySelector('#cleanup');
    btn.disabled = true;
    btn.textContent = 'Suppression…';
    try {
      await authedPost('/api/delete', { urls: outputUrls });
      outputUrls = [];
      results.innerHTML = '<p class="success center">Fichiers supprimés du cloud.</p>';
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Réessayer la suppression';
    }
  };
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
renderLocked();
if (password) unlock(password);
