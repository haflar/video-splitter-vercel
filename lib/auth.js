import crypto from 'node:crypto';

const LEGACY_HASH =
  'dfdb420dca32bd7563566d44da716d62f76b20ec548d0ff93903fdbf4e2b166c';

function safeEqualText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function isValidPassword(value) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 128) {
    return false;
  }

  const configured = process.env.APP_PASSWORD;
  if (configured) {
    return safeEqualText(value, configured);
  }

  const actual = crypto.createHash('sha256').update(value).digest();
  const expected = Buffer.from(LEGACY_HASH, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function requirePassword(req, res) {
  const password = req.headers['x-app-password'];
  if (!isValidPassword(password)) {
    res.status(401).json({ error: "Code d'accès incorrect." });
    return false;
  }
  return true;
}
