import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT ?? '3000', 10),
  url: process.env.APP_URL ?? 'http://localhost:3000',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:5173',
  desktopUrl: process.env.DESKTOP_URL ?? 'http://localhost:5174',
  invitationExpiryHours: parseInt(process.env.INVITATION_EXPIRY_HOURS ?? '72', 10),
}));
