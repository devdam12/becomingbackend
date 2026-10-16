const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const value = await derive(password, salt, 64);
  return timingSafeEqual(value, Buffer.from(hash, 'hex'));
}
const tokenHash = token => createHash('sha256').update(token).digest('hex');
module.exports = { hashPassword, verifyPassword, tokenHash };
