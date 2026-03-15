import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: (() => {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET environment variable is required');
    return s;
  })(),
  expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshSecret: (() => {
    const s = process.env.JWT_REFRESH_SECRET;
    if (!s)
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    return s;
  })(),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));
