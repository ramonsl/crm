import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'whatsapp-web.js',
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
    'thread-stream',
    'jimp',
    'sharp'
  ],
};

export default nextConfig;
