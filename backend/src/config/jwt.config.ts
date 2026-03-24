import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: (() => {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET environment variable is required');
    return s;
  })(),
  expiration: process.env.JWT_EXPIRATION || '15m',
  refreshSecret: (() => {
    const s = process.env.JWT_REFRESH_SECRET;
    if (!s) throw new Error('JWT_REFRESH_SECRET environment variable is required');
    return s;
  })(),
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));
