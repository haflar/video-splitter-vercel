import https from 'node:https';
import crypto from 'node:crypto';
import tls from 'node:tls';

const HOSTS = new Set([
  'www.consulatalgeriemontreal.com',
  'consulatalgeriemontreal.com'
]);
const PRIMARY_HOST = 'www.consulatalgeriemontreal.com';
const CALENDAR_PATH = '/rendez-vous/index.php';
const SERVICE_ID = '29';
const EXPECTED_SPKI = 'to8ZIWYsU32EfJhdKhSi0jNtyNKHCwIIz3vW/vMd7EE=';
const MAX_BODY = 1_500_000;

const OV_R36_PEM = \`-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j
lYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD
u+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc
FYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s
yy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX
gZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB
WRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x
bt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2
O44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
BZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr
7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR
MQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc
xlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod
e/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE
wLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ
MuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/
iPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib
QXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw
q1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX
58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=
-----END CERTIFICATE-----\`;

const ROOT_R46_PEM = \`-----BEGIN CERTIFICATE-----
MIIFijCCA3KgAwIBAgIQdY39i658BwD6qSWn4cetFDANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNNDYwMzIxMjM1OTU5WjBfMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQDEy1TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCTvtU2UnXYASOgHEdCSe5jtrch/cSV1UgrJnwUUxDa
ef0rty2k1Cz66jLdScK5vQ9IPXtamFSvnl0xdE8H/FAh3aTPaE8bEmNtJZlMKpnz
SDBh+oF8HqcIStw+KxwfGExxqjWMrfhu6DtK2eWUAtaJhBOqbchPM8xQljeSM9xf
iOefVNlI8JhD1mb9nxc4Q8UBUQvX4yMPFF1bFOdLvt30yNoDN9HWOaEhUTCDsG3X
ME6WW5HwcCSrv0WBZEMNvSE6Lzzpng3LILVCJ8zab5vuZDCQOc2TZYEhMbUjUDM3
IuM47fgxMMxF/mL50V0yeUKH32rMVhlATc6qu/m1dkmU8Sf4kaWD5QazYw6A3OAS
VYCmO2a0OYctyPDQ0RTp5A1NDvZdV3LFOxxHVp3i1fuBYYzMTYCQNFu31xR13NgE
SJ/AwSiItOkcyqex8Va3e0lMWeUgFaiEAin6OJRpmkkGj80feRQXEgyDet4fsZfu
+Zd4KKTIRJLpfSYFplhym3kT2BFfrsU4YjRosoYwjviQYZ4ybPUHNs2iTG7sijbt
8uaZFURww3y8nDnAtOFr94MlI1fZEoDlSfB1D++N6xybVCi0ITz8fAr/73trdf+L
HaAZBav6+CuBQug4urv7qv094PPK306Xlynt8xhW6aWWrL3DkJiy4Pmi1KZHQ3xt
zwIDAQABo0IwQDAdBgNVHQ4EFgQUVnNYZJX5khqwEioEYnmhQBWIIUkwDgYDVR0P
AQH/BAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAC9c
mTz8Bl6MlC5w6tIyMY208FHVvArzZJ8HXtXBc2hkeqK5Duj5XYUtqDdFqij0lgVQ
YKlJfp/imTYpE0RHap1VIDzYm/EDMrraQKFz6oOht0SmDpkBm+S8f74TlH7Kph52
gDY9hAaLMyZlbcp+nv4fjFg4exqDsQ+8FxG75gbMY/qB8oFM2gsQa6H61SilzwZA
Fv97fRheORKkU55+MkIQpiGRqRxOF3yEvJ+M0ejf5lG5Nkc/kLnHvALcWxxPDkjB
JYOcCj+esQMzEhonrPcibCTRAUH4WAP+JWgiH5paPHxsnnVI84HxZmduTILA7rpX
DhjvLpr3Etiga+kFpaHpaPi8TD8SHkXoUsCjvxInebnMMTzD9joiFgOgyY9mpFui
TdaBJQbpdqQACj7LzTWb4OE4y2BThihCQRxEV+ioratF4yUQvNs+ZUH7G6aXD+u5
dHn5HrwdVw1Hr8Mvn4dGp+smWg9WY7ViYG4A++MnESLn/pmPNPW56MORcr3Ywx65
LvKRRFHQV80MNNVIIb/bE/FmJUNS0nAiNs2fxBx1IK1jcmMGDw4nztJqDby1ORrp
0XZ60Vzk50lJLVU3aPAaOpg+VBeHVOmmJ1CJeyAvP/+/oYtKR5j/K3tJPsMpRmAY
QqszKbrAKbkTidOIijlBO8n9pu0f9GBj39ItVQGL
-----END CERTIFICATE-----\`;


function isAllowedUrl(value) {
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

function validatePeerCertificate(hostname, peer) {
  const hostError = tls.checkServerIdentity(hostname, peer);
  if (hostError) throw hostError;
  if (!peer?.raw) throw new Error('Certificat du consulat absent');

  const cert = new crypto.X509Certificate(peer.raw);
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

    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      servername: u.hostname,
      ca: [...tls.rootCertificates, OV_R36_PEM, ROOT_R46_PEM],
      checkServerIdentity: (hostname, peer) => {
        try {
          certificate = validatePeerCertificate(hostname, peer);
          return undefined;
        } catch (error) {
          return error;
        }
      },
      headers: {
        'User-Agent': 'RDV-Passeport-Montreal/relay-1.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.4',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      if (!certificate) {
        res.destroy();
        reject(new Error('Preuve TLS du consulat absente'));
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
        resolve({
          status: res.statusCode || 0,
          location: res.headers.location || '',
          contentType: String(res.headers['content-type'] || ''),
          html: Buffer.concat(chunks).toString('utf8'),
          certificate
        });
      });
    });

    req.setTimeout(20_000, () => req.destroy(new Error('Délai du consulat dépassé')));
    req.on('error', reject);
    req.end();
  });
}

async function fetchCalendar(initialUrl) {
  let current = initialUrl;
  for (let i = 0; i < 4; i += 1) {
    if (!isAllowedUrl(current)) throw new Error('URL du calendrier non autorisée');

    const result = await requestOnce(current);
    if (result.status >= 300 && result.status < 400) {
      if (!result.location) throw new Error('Redirection du consulat sans destination');
      const next = new URL(result.location, current).toString();
      if (!isAllowedUrl(next)) throw new Error('Redirection hors calendrier officiel bloquée');
      current = next;
      continue;
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error('HTTP ' + result.status + ' du consulat');
    }
    if (result.contentType && !result.contentType.toLowerCase().includes('text/html')) {
      throw new Error('Type de réponse inattendu du consulat');
    }

    return { ...result, finalUrl: current };
  }
  throw new Error('Trop de redirections du consulat');
}

function parseSlots(html, year, month, pageUrl) {
  if (!html || html.length < 500) throw new Error('Page calendrier trop courte');

  const allText = normalizeText(stripTags(html));
  const looksPassport = allText.includes('passeport')
    && (allText.includes('renouvellement') || allText.includes('premiere') || allText.includes('premier'));
  const looksCalendar = /<td\b/i.test(html) && allText.includes('rendez-vous');
  if (!looksPassport || !looksCalendar) {
    throw new Error('Page reçue ne ressemble pas au calendrier passeport officiel');
  }

  const cells = html.match(/<td\b[\s\S]*?<\/td>/gi) || [];
  const slots = [];
  const countRe = /(\d+)\s*place(?:\(s\)|s)?\s*disponible(?:\(s\)|s)?/i;
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
    while ((m = dayRe.exec(before)) !== null) day = Number.parseInt(m[1], 10);
    if (!day) continue;

    let bookingUrl = pageUrl;
    const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
    let href;
    while ((href = hrefRe.exec(cell)) !== null) {
      try {
        const absolute = new URL(decodeEntities(href[1]), pageUrl).toString();
        const u = new URL(absolute);
        if (u.protocol === 'https:' && HOSTS.has(u.hostname)) {
          bookingUrl = absolute;
          if (u.pathname.endsWith('/booking.php')) break;
        }
      } catch {}
    }

    slots.push({ year, month, day, count, bookingUrl });
  }
  return slots;
}

function monthSequence(count) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const months = Math.max(1, Math.min(6, Number.parseInt(String(req.query?.months || '4'), 10) || 4));
  const checked = [];
  const slots = [];
  let certificate = null;
  let sourceUrl = '';

  try {
    for (const item of monthSequence(months)) {
      const month = String(item.month).padStart(2, '0');
      const url = `https://${PRIMARY_HOST}${CALENDAR_PATH}?month=${month}&serviceID=${SERVICE_ID}&year=${item.year}`;
      const page = await fetchCalendar(url);
      if (!sourceUrl) sourceUrl = page.finalUrl;
      certificate = page.certificate;
      checked.push(`${month}/${item.year}`);
      slots.push(...parseSlots(page.html, item.year, item.month, page.finalUrl));
    }

    const totalPlaces = slots.reduce((sum, slot) => sum + slot.count, 0);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      ok: true,
      mode: 'pinned-public-relay',
      serviceId: 29,
      serviceLabel: 'Passeport — première demande / renouvellement',
      verifiedAt: new Date().toISOString(),
      monthsChecked: checked.join(', '),
      datesDetected: slots.length,
      totalPlaces,
      sourceUrl,
      certificate: certificate ? {
        subject: certificate.subject,
        issuer: certificate.issuer,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        spkiSha256: certificate.spkiSha256
      } : null,
      slots
    });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      ok: false,
      mode: 'pinned-public-relay',
      verifiedAt: new Date().toISOString(),
      error: error?.message || 'Erreur du relais'
    });
  }
}
