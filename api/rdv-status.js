import https from 'node:https';
import crypto from 'node:crypto';

const HOSTS = new Set([
  'www.consulatalgeriemontreal.com',
  'consulatalgeriemontreal.com'
]);
const PRIMARY_HOST = 'www.consulatalgeriemontreal.com';
const CALENDAR_PATH = '/rendez-vous/index.php';
const SERVICE_ID = '29';
const EXPECTED_SPKI = 'to8ZIWYsU32EfJhdKhSi0jNtyNKHCwIIz3vW/vMd7EE=';
const MAX_BODY = 1_500_000;

function isAllowedCalendarUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:'
      && HOSTS.has(u.hostname)
      && u.pathname === CALENDAR_PATH
      && u.searchParams.get('serviceID') === SERVICE_ID;
  } catch {
    return false;
  }
}

function isAllowedTargetUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !HOSTS.has(u.hostname)) return false;
    if (u.pathname !== '/rendez-vous/index.php' &&
        u.pathname !== '/rendez-vous/booking.php') return false;
    return u.searchParams.get('serviceID') === SERVICE_ID;
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function validatePinnedPeer(hostname, peer) {
  if (!peer?.raw) throw new Error('Certificat du consulat absent');

  const cert = new crypto.X509Certificate(peer.raw);
  if (!cert.checkHost(hostname)) {
    throw new Error('Nom TLS du consulat invalide');
  }

  const now = Date.now();
  const validFrom = Date.parse(cert.validFrom);
  const validTo = Date.parse(cert.validTo);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validTo) ||
      now < validFrom || now > validTo) {
    throw new Error('Certificat du consulat expiré ou pas encore valide');
  }

  const spki = cert.publicKey.export({ type: 'spki', format: 'der' });
  const pin = crypto.createHash('sha256').update(spki).digest('base64');
  if (pin !== EXPECTED_SPKI) {
    throw new Error('Clé publique du consulat modifiée: vérification manuelle requise');
  }

  return {
    subject: cert.subject,
    issuer: cert.issuer,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    spkiSha256: pin
  };
}

function requestOnce(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    let certificate = null;
    let done = false;

    const finishReject = (error) => {
      if (done) return;
      done = true;
      reject(error);
    };

    const req = https.request({
      protocol: 'https:',
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      rejectUnauthorized: false,
      servername: u.hostname,
      headers: {
        'User-Agent': 'RDV-Passeport-Montreal/relay-live-1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.4',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      if (!certificate) {
        res.destroy();
        finishReject(new Error('Preuve TLS du consulat absente'));
        return;
      }

      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_BODY) {
          req.destroy(new Error('Réponse du calendrier trop volumineuse'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (done) return;
        done = true;
        resolve({
          status: res.statusCode || 0,
          location: res.headers.location || '',
          contentType: String(res.headers['content-type'] || ''),
          html: Buffer.concat(chunks).toString('utf8'),
          certificate
        });
      });
    });

    req.on('socket', (socket) => {
      socket.once('secureConnect', () => {
        try {
          const peer = socket.getPeerCertificate(true);
          certificate = validatePinnedPeer(u.hostname, peer);
        } catch (error) {
          socket.destroy(error);
        }
      });
    });

    req.setTimeout(20_000, () =>
      req.destroy(new Error('Délai du consulat dépassé')));
    req.on('error', finishReject);
    req.end();
  });
}

async function fetchCalendar(initialUrl) {
  let current = initialUrl;
  for (let i = 0; i < 4; i += 1) {
    if (!isAllowedCalendarUrl(current)) {
      throw new Error('URL du calendrier non autorisée');
    }

    const result = await requestOnce(current);

    if (result.status >= 300 && result.status < 400) {
      if (!result.location) {
        throw new Error('Redirection du consulat sans destination');
      }
      const next = new URL(result.location, current).toString();
      if (!isAllowedCalendarUrl(next)) {
        throw new Error('Redirection hors calendrier officiel bloquée');
      }
      current = next;
      continue;
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error('HTTP ' + result.status + ' du consulat');
    }

    if (result.contentType &&
        !result.contentType.toLowerCase().includes('text/html')) {
      throw new Error('Type de réponse inattendu du consulat');
    }

    return { ...result, finalUrl: current };
  }

  throw new Error('Trop de redirections du consulat');
}

function parseSlots(html, year, month, pageUrl) {
  if (!html || html.length < 500) {
    throw new Error('Page calendrier trop courte');
  }

  const allText = normalizeText(stripTags(html));
  const looksPassport = allText.includes('passeport')
    && (allText.includes('renouvellement')
      || allText.includes('premiere')
      || allText.includes('premier'));
  const looksCalendar = /<td\b/i.test(html) && allText.includes('rendez-vous');

  if (!looksPassport || !looksCalendar) {
    throw new Error('Page reçue ne ressemble pas au calendrier passeport officiel');
  }

  const cells = html.match(/<td\b[\s\S]*?<\/td>/gi) || [];
  const slots = [];
  const countRe =
    /(\d+)\s*place(?:\(s\)|s)?\s*disponible(?:\(s\)|s)?/i;
  const dayRe = /(?:^|\D)([1-9]|[12]\d|3[01])(?:\D|$)/g;

  for (const cell of cells) {
    const text = stripTags(cell);
    const countMatch = countRe.exec(text);
    if (!countMatch) continue;

    const count = Number.parseInt(countMatch[1], 10);
    if (!Number.isFinite(count) || count <= 0) continue;

    const before = text.slice(0, countMatch.index);
    let day = 0;
    let m;
    while ((m = dayRe.exec(before)) !== null) {
      day = Number.parseInt(m[1], 10);
    }
    if (!day) continue;

    let bookingUrl = pageUrl;
    const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
    let href;
    while ((href = hrefRe.exec(cell)) !== null) {
      try {
        const absolute = new URL(decodeEntities(href[1]), pageUrl).toString();
        if (isAllowedTargetUrl(absolute)) {
          bookingUrl = absolute;
          if (new URL(absolute).pathname.endsWith('/booking.php')) break;
        }
      } catch {}
    }

    slots.push({ year, month, day, count, bookingUrl });
  }

  return slots;
}

function monthSequence(count) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date());

  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    out.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1
    });
  }

  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const months = Math.max(
    1,
    Math.min(6, Number.parseInt(String(req.query?.months || '4'), 10) || 4)
  );

  const checked = [];
  const slots = [];
  let certificate = null;
  let sourceUrl = '';

  try {
    for (const item of monthSequence(months)) {
      const month = String(item.month).padStart(2, '0');
      const url =
        'https://' + PRIMARY_HOST + CALENDAR_PATH +
        '?month=' + month +
        '&serviceID=' + SERVICE_ID +
        '&year=' + item.year;

      const page = await fetchCalendar(url);

      if (!sourceUrl) sourceUrl = page.finalUrl;
      certificate = page.certificate;
      checked.push(month + '/' + item.year);
      slots.push(
        ...parseSlots(page.html, item.year, item.month, page.finalUrl)
      );
    }

    const totalPlaces =
      slots.reduce((sum, slot) => sum + slot.count, 0);

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
      ok: true,
      mode: 'pinned-public-relay-live',
      serviceId: 29,
      serviceLabel: 'Passeport — première demande / renouvellement',
      verifiedAt: new Date().toISOString(),
      monthsChecked: checked.join(', '),
      datesDetected: slots.length,
      totalPlaces,
      sourceUrl,
      certificate,
      slots
    });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      ok: false,
      mode: 'pinned-public-relay-live',
      verifiedAt: new Date().toISOString(),
      error: error?.message || 'Erreur du relais'
    });
  }
}
