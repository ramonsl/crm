import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora pacotes de servidor no build client
  serverExternalPackages: [
    'whatsapp-web.js',
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
    'thread-stream',
    'jimp',
    'sharp',
    'puppeteer',
    'puppeteer-core',
    '@wppconnect-team/wppconnect',
    'electron',
    'keyv'
  ],

  // Configuração Webpack para ignorar dependências binárias
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'electron': 'commonjs electron',
    });
    return config;
  },

  // Silencia erro de Turbopack + Webpack config
  turbopack: {},
};

export default nextConfig;
