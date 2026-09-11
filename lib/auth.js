import crypto from 'node:crypto';

const EXPECTED_HASH = 'dfdb420dca32bd7563566d44da716d62f76b20ec548d0ff93903fdbf4e2b166c';

export function isValidPassword(value) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 128) return false;
  const actual = crypto.createHash('sha256').update(value).digest();
  const expected = Buffer.from(EXPECTED_HASH, 'hex');
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
