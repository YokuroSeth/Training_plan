import crypto from 'node:crypto';

const authWindowSeconds = 24 * 60 * 60;

export function verifyTelegramInitData(initData, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof initData !== 'string' || !initData || typeof botToken !== 'string' || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isInteger(authDate)) return null;
  if (Math.abs(nowSeconds - authDate) > authWindowSeconds) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  const expectedHash = Buffer.from(receivedHash, 'hex');
  if (calculatedHash.length !== expectedHash.length || !crypto.timingSafeEqual(calculatedHash, expectedHash)) return null;

  const user = params.get('user');
  try {
    return { user: user ? JSON.parse(user) : null, authDate };
  } catch {
    return null;
  }
}
